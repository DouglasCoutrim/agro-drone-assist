import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const corsHeadersRestricted = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
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

    const { venda_id, provider = 'focusnfe' } = await req.json();
    if (!venda_id) return json({ error: 'venda_id é obrigatório' }, 400);

    // Buscar venda com itens
    const { data: venda, error: vendaErr } = await admin
      .from('vendas')
      .select(`
        *,
        venda_itens (*),
        clientes!vendas_cliente_id_fkey (*)
      `)
      .eq('id', venda_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (vendaErr) throw vendaErr;
    if (!venda) return json({ error: 'Venda não encontrada' }, 404);

    // Verificar se já tem NF
    if (venda.nf_chave) {
      return json({ error: 'Venda já possui NFe emitida', nf: { numero: venda.nf_numero, chave_acesso: venda.nf_chave } }, 400);
    }

    // Buscar configuração da empresa
    const { data: empresa } = await admin
      .from('empresa_config')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!empresa) return json({ error: 'Configuração da empresa não encontrada' }, 400);

    // Preparar dados para NFe
    const nfeData = buildNFeData(venda, empresa, profile.organization_id);

    // Emitir NFe via Focus NFe
    if (provider === 'focusnfe') {
      const result = await emitirNFeFocus(nfeData, empresa);
      
      // Salvar NF emitida
      const nfInsert = await admin.from('nota_fiscal_emitida').insert({
        organization_id: profile.organization_id,
        tipo: 'nfe',
        numero: result.numero,
        serie: result.serie,
        chave_acesso: result.chave_acesso,
        xml_url: result.xml_url,
        pdf_url: result.pdf_url,
        xml_conteudo: result.xml,
        cliente_id: venda.cliente_id,
        cliente_nome: venda.cliente_nome,
        cliente_cpf_cnpj: venda.cliente_cpf_cnpj,
        cliente_email: venda.cliente_email,
        valor_total: venda.valor_total,
        valor_impostos: venda.valor_impostos,
        valor_liquido: venda.valor_total - venda.valor_impostos,
        status: 'autorizado',
        venda_id: venda.id,
        provider: 'focusnfe',
        provider_id: result.id_externo,
        emitida_por: userId,
        emitida_em: new Date().toISOString(),
      }).select().single();

      if (nfInsert.error) throw nfInsert.error;

      // Salvar itens da NF
      if (nfeData.itens.length > 0 && nfInsert.data) {
        const nfItens = nfeData.itens.map((item: any, idx: number) => ({
          nf_id: nfInsert.data!.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total,
          ncm: item.ncm,
          cfop: item.cfop,
        }));
        await admin.from('nota_fiscal_itens').insert(nfItens);
      }

      // Atualizar venda
      await admin.from('vendas').update({
        nf_numero: result.numero,
        nf_chave: result.chave_acesso,
        nf_emitida_em: new Date().toISOString(),
        nf_provider: 'focusnfe',
      }).eq('id', venda_id);

      // Registrar evento
      await admin.from('nota_fiscal_eventos').insert({
        nf_id: nfInsert.data!.id,
        tipo_evento: 'autorizacao',
        descricao: 'NFe autorizada pela SEFAZ',
        dados_evento: { chave: result.chave_acesso, protocolo: result.protocolo },
      });

      return json({ success: true, nf: { ...result, id: nfInsert.data!.id } });
    }

    return json({ error: 'Provider não suportado' }, 400);

  } catch (e: any) {
    console.error('emitir-nfe-venda error:', e);
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

interface NFeItem {
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms: {
    origem: number;
    cst: string;
    aliquota: number;
    valor: number;
  };
  ipi?: {
    cst: string;
    aliquota: number;
    valor: number;
  };
  pis_cofins: {
    cst: string;
    aliquota_pis: number;
    aliquota_cofins: number;
    valor_pis: number;
    valor_cofins: number;
  };
}

interface NFeData {
  natureza_operacao: string;
  modelo: number;
  serie: number;
  numero: number;
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
  itens: NFeItem[];
  transporte: {
    modalidade_frete: number;
  };
  pagamento: {
    forma_pagamento: number;
    valor: number;
  };
  observacoes?: string;
}

function buildNFeData(venda: any, empresa: any, organizationId: string): NFeData {
  const cliente = venda.clientes || {};
  
  // Endereço padrão da empresa (fallback)
  const enderecoEmpresa = {
    logradouro: empresa.endereco_logradouro || 'Rua Exemplo',
    numero: empresa.endereco_numero || '100',
    complemento: empresa.endereco_complemento || '',
    bairro: empresa.endereco_bairro || 'Centro',
    codigo_municipio: empresa.endereco_codigo_municipio || '3550308', // São Paulo
    uf: empresa.endereco_uf || 'SP',
    cep: empresa.endereco_cep?.replace(/\D/g, '') || '01000000',
  };

  // Endereço do cliente (fallback para empresa)
  const enderecoCliente = cliente.endereco_logradouro ? {
    logradouro: cliente.endereco_logradouro,
    numero: cliente.endereco_numero || 'S/N',
    complemento: cliente.endereco_complemento || '',
    bairro: cliente.endereco_bairro || 'Centro',
    codigo_municipio: cliente.endereco_codigo_municipio || '3550308',
    uf: cliente.endereco_uf || 'SP',
    cep: cliente.endereco_cep?.replace(/\D/g, '') || '01000000',
  } : enderecoEmpresa;

  // Gerar número da NF
  const numero = Math.floor(Math.random() * 900000) + 100000;
  const serie = 1;

  const itens: NFeItem[] = (venda.venda_itens || []).map((item: any, idx: number) => {
    const aliquotaIcms = 18; // Padrão SP
    const valorIcms = (item.valor_total * aliquotaIcms) / 100;
    
    return {
      numero_item: idx + 1,
      codigo_produto: item.produto_id || `ITEM-${idx + 1}`,
      descricao: item.nome_produto,
      ncm: item.ncm || '99999999',
      cfop: item.cfop || '5102',
      unidade: 'UN',
      quantidade: item.quantidade,
      valor_unitario: item.preco_unitario,
      valor_total: item.valor_total,
      icms: {
        origem: 0,
        cst: '00',
        aliquota: aliquotaIcms,
        valor: valorIcms,
      },
      pis_cofins: {
        cst: '01',
        aliquota_pis: 0.65,
        aliquota_cofins: 3.0,
        valor_pis: item.valor_total * 0.0065,
        valor_cofins: item.valor_total * 0.03,
      },
    };
  });

  return {
    natureza_operacao: 'Venda de mercadoria',
    modelo: 55, // NFe
    serie,
    numero,
    data_emissao: new Date().toISOString(),
    cliente: {
      nome: venda.cliente_nome,
      cpf_cnpj: venda.cliente_cpf_cnpj?.replace(/\D/g, '') || '00000000000',
      email: venda.cliente_email,
      endereco: enderecoCliente,
    },
    itens,
    transporte: {
      modalidade_frete: 9, // Sem frete
    },
    pagamento: {
      forma_pagamento: formaPagamentoToNFe(venda.forma_pagamento),
      valor: venda.valor_total,
    },
    observacoes: venda.obs,
  };
}

function formaPagamentoToNFe(forma: string): number {
  const map: Record<string, number> = {
    dinheiro: 1,
    cheque: 2,
    debito: 3,
    credito: 4,
    pix: 17,
    boleto: 5,
  };
  return map[forma] || 99;
}

async function emitirNFeFocus(nfeData: NFeData, empresa: any) {
  const focusApiKey = empresa.focus_nfe_api_key || Deno.env.get('FOCUS_NFE_API_KEY');
  const focusEnvironment = empresa.focus_nfe_environment || 'homologacao';
  
  if (!focusApiKey) {
    throw new Error('FOCUS_NFE_API_KEY não configurado na empresa_config ou nas secrets');
  }

  const baseUrl = focusEnvironment === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2';

  const ref = `venda-${nfeData.numero}-${Date.now()}`;

  // Payload Focus NFe
  const payload = {
    natureza_operacao: nfeData.natureza_operacao,
    modelo: nfeData.modelo,
    serie: nfeData.serie,
    numero: nfeData.numero,
    data_emissao: nfeData.data_emissao.slice(0, 19).replace('T', ' '),
    cliente: {
      nome: nfeData.cliente.nome,
      cpf_cnpj: nfeData.cliente.cpf_cnpj,
      email: nfeData.cliente.email,
      endereco: nfeData.cliente.endereco,
    },
    itens: nfeData.itens.map(item => ({
      numero_item: item.numero_item,
      codigo_produto: item.codigo_produto,
      descricao: item.descricao,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade_comercial: item.unidade,
      quantidade_comercial: item.quantidade,
      valor_unitario_comercial: item.valor_unitario,
      valor_bruto: item.valor_total,
      icms: {
        origem: item.icms.origem,
        cst: item.icms.cst,
        aliquota: item.icms.aliquota,
        valor: item.icms.valor,
      },
      ipi: item.ipi ? {
        cst: item.ipi.cst,
        aliquota: item.ipi.aliquota,
        valor: item.ipi.valor,
      } : undefined,
      pis: {
        cst: item.pis_cofins.cst,
        aliquota: item.pis_cofins.aliquota_pis,
        valor: item.pis_cofins.valor_pis,
      },
      cofins: {
        cst: item.pis_cofins.cst,
        aliquota: item.pis_cofins.aliquota_cofins,
        valor: item.pis_cofins.valor_cofins,
      },
    })),
    transporte: {
      modalidade_frete: nfeData.transporte.modalidade_frete,
    },
    pagamento: [
      {
        forma_pagamento: nfeData.pagamento.forma_pagamento,
        valor: nfeData.pagamento.valor,
      },
    ],
    informacoes_adicionais: nfeData.observacoes || '',
  };

  // Enviar para Focus NFe
  const response = await fetch(`${baseUrl}/nfe?ref=${ref}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${focusApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || result.erro || 'Erro ao emitir NFe');
  }

  // Aguardar processamento (polling)
  let status = 'processando';
  let tentativas = 0;
  let nfeResult: any = null;

  while (status === 'processando' && tentativas < 30) {
    await new Promise(r => setTimeout(r, 2000));
    const statusResp = await fetch(`${baseUrl}/nfe/${ref}`, {
      headers: { 'Authorization': `Bearer ${focusApiKey}` },
    });
    nfeResult = await statusResp.json();
    status = nfeResult.status;
    tentativas++;
  }

  if (status !== 'autorizado') {
    throw new Error(nfeResult?.motivo || 'NFe não autorizada após timeout');
  }

  return {
    numero: nfeData.numero,
    serie: nfeData.serie,
    chave_acesso: nfeResult.chave_acesso,
    xml_url: nfeResult.caminho_xml_nota_fiscal,
    pdf_url: nfeResult.caminho_danfe,
    xml: nfeResult.xml,
    protocolo: nfeResult.protocolo,
    id_externo: ref,
  };
}