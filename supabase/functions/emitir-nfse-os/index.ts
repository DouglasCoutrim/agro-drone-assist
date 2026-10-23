import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const corsHeadersRestricted = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Role check
    const { data: roleRows } = await admin
      .from('user_roles').select('role').eq('user_id', userId).in('role', ['admin', 'tecnico']);
    if (!roleRows?.length) {
      return json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    if (!profile?.organization_id) return json({ error: 'Sem organização' }, 400);

    const { os_id, provider = 'focusnfe' } = await req.json();
    if (!os_id) return json({ error: 'os_id é obrigatório' }, 400);

    // Buscar OS com itens
    const { data: os, error: osErr } = await admin
      .from('ordens_servico')
      .select(`
        *,
        os_itens (*),
        clientes!ordens_servico_cliente_id_fkey (*)
      `)
      .eq('id', os_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (osErr) throw osErr;
    if (!os) return json({ error: 'Ordem de serviço não encontrada' }, 404);

    // Verificar se já tem NF
    const { data: nfExistente } = await admin
      .from('nota_fiscal_emitida')
      .select('id')
      .eq('os_id', os_id)
      .maybeSingle();

    if (nfExistente) {
      return json({ error: 'OS já possui NFSe emitida' }, 400);
    }

    // Buscar configuração da empresa
    const { data: empresa } = await admin
      .from('empresa_config')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!empresa) return json({ error: 'Configuração da empresa não encontrada' }, 400);

    // Preparar dados para NFSe
    const nfseData = buildNFSeData(os, empresa, profile.organization_id);

    // Emitir NFSe via Focus NFe
    if (provider === 'focusnfe') {
      const result = await emitirNFSeFocus(nfseData, empresa);
      
      // Salvar NF emitida
      const nfInsert = await admin.from('nota_fiscal_emitida').insert({
        organization_id: profile.organization_id,
        tipo: 'nfse',
        numero: result.numero,
        serie: result.serie,
        chave_acesso: result.chave_acesso,
        xml_url: result.xml_url,
        pdf_url: result.pdf_url,
        xml_conteudo: result.xml,
        cliente_id: os.cliente_id,
        cliente_nome: os.clientes?.nome || os.cliente_nome,
        cliente_cpf_cnpj: os.clientes?.cpf_cnpj,
        cliente_email: os.clientes?.email,
        valor_total: os.valor_total || os.valor_servicos,
        valor_impostos: os.valor_impostos || 0,
        valor_liquido: (os.valor_total || os.valor_servicos) - (os.valor_impostos || 0),
        status: 'autorizado',
        os_id: os.id,
        provider: 'focusnfe',
        provider_id: result.id_externo,
        emitida_por: userId,
        emitida_em: new Date().toISOString(),
      }).select().single();

      if (nfInsert.error) throw nfInsert.error;

      // Salvar itens da NF
      if (nfseData.itens.length > 0 && nfInsert.data) {
        const nfItens = nfseData.itens.map((item: any) => ({
          nf_id: nfInsert.data!.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
        }));
        await admin.from('nota_fiscal_itens').insert(nfItens);
      }

      // Atualizar OS
      await admin.from('ordens_servico').update({
        nf_numero: result.numero,
        nf_chave: result.chave_acesso,
        nf_emitida_em: new Date().toISOString(),
        nf_provider: 'focusnfe',
      }).eq('id', os_id);

      // Registrar evento
      await admin.from('nota_fiscal_eventos').insert({
        nf_id: nfInsert.data!.id,
        tipo_evento: 'autorizacao',
        descricao: 'NFSe autorizada pela prefeitura',
        dados_evento: { chave: result.chave_acesso, protocolo: result.protocolo },
      });

      return json({ success: true, nf: { ...result, id: nfInsert.data!.id } });
    }

    return json({ error: 'Provider não suportado' }, 400);

  } catch (e: any) {
    console.error('emitir-nfse-os error:', e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    status,
  });
}

// ============================================
// HELPERS
// ============================================

interface NFSeItem {
  numero_item: number;
  codigo_servico: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  aliquota_iss: number;
  valor_iss: number;
  cst_iss: string;
}

interface NFSeData {
  numero: string;
  serie: string;
  data_emissao: string;
  cliente: {
    nome: string;
    cpf_cnpj: string;
    email?: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      codigo_municipio: string;
      uf: string;
      cep: string;
    };
  };
  itens: NFSeItem[];
  observacoes?: string;
}

function buildNFSeData(os: any, empresa: any, organizationId: string): NFSeData {
  const cliente = os.clientes || {};
  
  // Endereço padrão da empresa
  const enderecoEmpresa = {
    logradouro: empresa.endereco_logradouro || 'Rua Exemplo',
    numero: empresa.endereco_numero || '100',
    complemento: empresa.endereco_complemento || '',
    bairro: empresa.endereco_bairro || 'Centro',
    codigo_municipio: empresa.endereco_codigo_municipio || '3550308',
    uf: empresa.endereco_uf || 'SP',
    cep: empresa.endereco_cep?.replace(/\D/g, '') || '01000000',
  };

  const enderecoCliente = cliente.endereco_logradouro ? {
    logradouro: cliente.endereco_logradouro,
    numero: cliente.endereco_numero || 'S/N',
    complemento: cliente.endereco_complemento || '',
    bairro: cliente.endereco_bairro || 'Centro',
    codigo_municipio: cliente.endereco_codigo_municipio || '3550308',
    uf: cliente.endereco_uf || 'SP',
    cep: cliente.endereco_cep?.replace(/\D/g, '') || '01000000',
  } : enderecoEmpresa;

  // Gerar número da NFSe
  const numero = `NFSe-${Math.floor(Math.random() * 900000) + 100000}`;
  const serie = '1';

  // Itens de serviço
  const itens: NFSeItem[] = (os.os_itens || []).filter((item: any) => item.tipo === 'servico').map((item: any, idx: number) => {
    const aliquotaIss = 5; // Padrão - configurável por município
    const valorIss = (item.valor_total * aliquotaIss) / 100;
    
    return {
      numero_item: idx + 1,
      codigo_servico: item.codigo_servico || '01.01',
      descricao: item.descricao,
      quantidade: item.quantidade || 1,
      valor_unitario: item.valor_unitario || item.valor_total,
      valor_total: item.valor_total,
      aliquota_iss: aliquotaIss,
      valor_iss: valorIss,
      cst_iss: '01', // Tributação normal
    };
  });

  // Se não tem itens de serviço, criar um item genérico
  if (itens.length === 0) {
    const valorTotal = os.valor_servicos || os.valor_total || 0;
    const aliquotaIss = 5;
    itens.push({
      numero_item: 1,
      codigo_servico: '01.01',
      descricao: os.descricao_servico || 'Serviços de manutenção de drones agrícolas',
      quantidade: 1,
      valor_unitario: valorTotal,
      valor_total: valorTotal,
      aliquota_iss: aliquotaIss,
      valor_iss: (valorTotal * aliquotaIss) / 100,
      cst_iss: '01',
    });
  }

  return {
    numero,
    serie,
    data_emissao: new Date().toISOString(),
    cliente: {
      nome: os.clientes?.nome || os.cliente_nome,
      cpf_cnpj: os.clientes?.cpf_cnpj?.replace(/\D/g, '') || '00000000000',
      email: os.clientes?.email,
      endereco: enderecoCliente,
    },
    itens,
    observacoes: os.obs,
  };
}

async function emitirNFSeFocus(nfseData: NFSeData, empresa: any) {
  const focusApiKey = empresa.focus_nfe_api_key || Deno.env.get('FOCUS_NFE_API_KEY');
  const focusEnvironment = empresa.focus_nfe_environment || 'homologacao';
  
  if (!focusApiKey) {
    throw new Error('FOCUS_NFE_API_KEY não configurado');
  }

  const baseUrl = focusEnvironment === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2';

  const ref = `nfse-${nfseData.numero}-${Date.now()}`;

  // Payload Focus NFe para NFSe
  const payload = {
    data_emissao: nfseData.data_emissao.slice(0, 19).replace('T', ' '),
    cliente: {
      nome: nfseData.cliente.nome,
      cpf_cnpj: nfseData.cliente.cpf_cnpj,
      email: nfseData.cliente.email,
      endereco: nfseData.cliente.endereco,
    },
    servico: {
      itens: nfseData.itens.map(item => ({
        numero_item: item.numero_item,
        codigo_servico: item.codigo_servico,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        aliquota_iss: item.aliquota_iss,
        valor_iss: item.valor_iss,
        cst_iss: item.cst_iss,
      })),
    },
    informacoes_adicionais: nfseData.observacoes || '',
  };

  // Enviar para Focus NFe (endpoint NFSe)
  const response = await fetch(`${baseUrl}/nfse?ref=${ref}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${focusApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || result.erro || 'Erro ao emitir NFSe');
  }

  // Aguardar processamento
  let status = 'processando';
  let tentativas = 0;
  let nfseResult: any = null;

  while (status === 'processando' && tentativas < 30) {
    await new Promise(r => setTimeout(r, 2000));
    const statusResp = await fetch(`${baseUrl}/nfse/${ref}`, {
      headers: { 'Authorization': `Bearer ${focusApiKey}` },
    });
    nfseResult = await statusResp.json();
    status = nfseResult.status;
    tentativas++;
  }

  if (status !== 'autorizado') {
    throw new Error(nfseResult?.motivo || 'NFSe não autorizada após timeout');
  }

  return {
    numero: nfseResult.numero_nfse || nfseData.numero,
    serie: nfseData.serie,
    chave_acesso: nfseResult.chave_nfse || nfseResult.chave_acesso,
    xml_url: nfseResult.caminho_xml_nfse,
    pdf_url: nfseResult.caminho_pdf_nfse,
    xml: nfseResult.xml,
    protocolo: nfseResult.protocolo,
    id_externo: ref,
  };
}