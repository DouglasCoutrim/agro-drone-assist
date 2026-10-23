import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { absoluteUrl, focusErrorMessage, focusRequest, focusToken, mapStatus, onlyDigits, dataEmissaoBrasil } from '../_shared/focus-nfe.ts';

const Body = z.object({
  action: z.enum(['validar', 'emitir', 'consultar']).default('emitir'),
  os_id: z.string().uuid().optional(),
  nf_id: z.string().uuid().optional(),
  servico: z.object({
    discriminacao: z.string().max(2000).optional(),
    valor_servicos: z.number().nonnegative().optional(),
    aliquota: z.number().min(0).max(100).optional(),
    iss_retido: z.boolean().optional(),
    item_lista_servico: z.string().max(10).optional(),
    codigo_tributario_municipio: z.string().max(30).optional(),
  }).optional(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: 'Não autenticado' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userId).in('role', ['admin', 'tecnico']);
    if (!roles?.length) return json({ error: 'Sem permissão para emitir notas fiscais' }, 403);
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) return json({ error: 'Usuário sem empresa vinculada' }, 400);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Requisição inválida', detalhes: parsed.error.flatten().fieldErrors }, 400);
    const { action, os_id, nf_id, servico: override } = parsed.data;
    const { data: config } = await admin.from('nfe_config').select('*').eq('organization_id', orgId).maybeSingle();

    if (action === 'consultar') {
      if (!nf_id || !config) return json({ error: 'Nota ou configuração não encontrada' }, 400);
      const { data: nf } = await admin.from('nota_fiscal_emitida').select('*').eq('id', nf_id).eq('organization_id', orgId).maybeSingle();
      if (!nf) return json({ error: 'Nota não encontrada' }, 404);
      const cfg = { ...config, ambiente: nf.ambiente };
      const r = await focusRequest(cfg, 'GET', `/v2/nfse/${encodeURIComponent(nf.referencia)}`);
      return json({ success: true, nf: await applyResult(admin, cfg, nf, r.data) });
    }

    if (!os_id) return json({ error: 'os_id é obrigatório' }, 400);
    const { data: os } = await admin.from('ordens_servico')
      .select('*, itens_os(*), clientes!ordens_servico_cliente_id_fkey(*)')
      .eq('id', os_id).eq('organization_id', orgId).maybeSingle();
    if (!os) return json({ error: 'Ordem de serviço não encontrada' }, 404);

    const servicos = (os.itens_os || []).filter((i: any) => i.tipo === 'servico');
    const valorItens = servicos.reduce((s: number, i: any) => s + Number(i.valor_total || 0), 0);
    const srv = {
      valor_servicos: Number((override?.valor_servicos ?? (valorItens || Number(os.valor_final || 0))).toFixed(2)),
      discriminacao: override?.discriminacao || config?.nfse_discriminacao_padrao ||
        (servicos.map((i: any) => `${i.descricao} (${i.quantidade}x)`).join('; ') || `Serviços da OS ${os.numero}`),
      aliquota: override?.aliquota ?? Number(config?.nfse_aliquota || 0),
      iss_retido: override?.iss_retido ?? !!config?.nfse_iss_retido,
      item_lista_servico: override?.item_lista_servico || config?.nfse_item_lista_servico || '',
      codigo_tributario_municipio: override?.codigo_tributario_municipio || config?.nfse_codigo_tributario_municipio || '',
    };

    const problemas = validar(config, os, srv);
    if (action === 'validar') return json({ success: problemas.length === 0, problemas, servico: srv });
    if (problemas.length) return json({ error: 'Dados incompletos para emissão', problemas }, 422);

    const { data: existente } = await admin.from('nota_fiscal_emitida').select('id,status')
      .eq('os_id', os_id).eq('tipo', 'nfse').in('status', ['processando', 'autorizado']).maybeSingle();
    if (existente) return json({ error: existente.status === 'autorizado' ? 'Esta OS já possui NFS-e autorizada' : 'Já existe uma NFS-e em processamento para esta OS', nf_id: existente.id }, 409);

    const cli = os.clientes;
    const referencia = `${orgId.slice(0, 8)}-nfse-${os.numero}-${Date.now()}`;
    const doc = onlyDigits(cli.cpf_cnpj);
    const payload = {
      data_emissao: dataEmissaoBrasil(),
      natureza_operacao: config.nfse_natureza_operacao || '1',
      optante_simples_nacional: config.regime_tributario === 1 || config.regime_tributario === 2,
      prestador: {
        cnpj: onlyDigits(config.cnpj),
        inscricao_municipal: onlyDigits(config.inscricao_municipal),
        codigo_municipio: onlyDigits(config.codigo_municipio),
      },
      tomador: {
        ...(doc.length === 14 ? { cnpj: doc } : { cpf: doc }),
        razao_social: cli.nome,
        ...(cli.email ? { email: cli.email } : {}),
        ...(cli.telefone ? { telefone: onlyDigits(cli.telefone) } : {}),
        endereco: {
          logradouro: cli.endereco, numero: cli.numero || 'S/N',
          ...(cli.complemento ? { complemento: cli.complemento } : {}),
          bairro: cli.bairro, codigo_municipio: onlyDigits(cli.codigo_municipio),
          uf: (cli.estado || '').toUpperCase(), cep: onlyDigits(cli.cep),
        },
      },
      servico: {
        aliquota: srv.aliquota,
        discriminacao: srv.discriminacao,
        iss_retido: srv.iss_retido,
        item_lista_servico: srv.item_lista_servico,
        ...(srv.codigo_tributario_municipio ? { codigo_tributario_municipio: srv.codigo_tributario_municipio } : {}),
        ...(config.nfse_codigo_cnae ? { codigo_cnae: onlyDigits(config.nfse_codigo_cnae) } : {}),
        codigo_nbs: onlyDigits(config.nfse_codigo_nbs || '115021000'),
        codigo_indicador_operacao: onlyDigits(config.nfse_codigo_indop || '100301'),
        ibs_cbs_classificacao_tributaria: onlyDigits(config.nfse_ibs_cbs_class_trib || '000001'),
        ibs_cbs_situacao_tributaria: onlyDigits(config.nfse_ibs_cbs_cst || '000'),
        valor_servicos: srv.valor_servicos,
      },
    };
    const valorIss = Number((srv.valor_servicos * srv.aliquota / 100).toFixed(2));

    const { data: nf, error: nfErr } = await admin.from('nota_fiscal_emitida').insert({
      organization_id: orgId, tipo: 'nfse', ambiente: config.ambiente, referencia,
      cliente_id: os.cliente_id, cliente_nome: cli.nome, cliente_cpf_cnpj: cli.cpf_cnpj, cliente_email: cli.email,
      valor_total: srv.valor_servicos, valor_impostos: valorIss, valor_liquido: srv.valor_servicos - (srv.iss_retido ? valorIss : 0),
      status: 'processando', os_id, provider: 'focusnfe', provider_id: referencia, payload_envio: payload, emitida_por: userId,
    }).select().single();
    if (nfErr) throw nfErr;
    await admin.from('nota_fiscal_itens').insert({ nf_id: nf.id, descricao: srv.discriminacao.slice(0, 500), quantidade: 1, valor_unitario: srv.valor_servicos, valor_total: srv.valor_servicos });

    const envio = await focusRequest(config, 'POST', `/v2/nfse?ref=${encodeURIComponent(referencia)}`, payload);
    if (!envio.ok) {
      const motivo = focusErrorMessage(envio.data);
      await admin.from('nota_fiscal_emitida').update({ status: 'rejeitado', motivo_rejeicao: motivo, payload_retorno: envio.data }).eq('id', nf.id);
      await admin.from('nota_fiscal_eventos').insert({ nf_id: nf.id, tipo_evento: 'rejeicao', descricao: motivo, dados_evento: envio.data });
      return json({ error: motivo, nf_id: nf.id }, 422);
    }

    let atual = nf;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const c = await focusRequest(config, 'GET', `/v2/nfse/${encodeURIComponent(referencia)}`);
      atual = await applyResult(admin, config, atual, c.data);
      if (atual.status !== 'processando') break;
    }
    if (atual.status === 'rejeitado') return json({ error: atual.motivo_rejeicao || 'NFS-e rejeitada pela prefeitura', nf: atual }, 422);
    return json({ success: true, nf: atual });
  } catch (e: any) {
    console.error('emitir-nfse-os', e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});

function validar(config: any, os: any, srv: any): string[] {
  const p: string[] = [];
  if (!config) return ['Configure os dados fiscais da empresa em Fiscal → Configuração.'];
  if (!config.nfse_habilitado) p.push('A emissão de NFS-e está desativada nas configurações fiscais.');
  if (!focusToken(config)) p.push('Token da Focus NFe não informado para o ambiente selecionado.');
  if (onlyDigits(config.cnpj).length !== 14) p.push('CNPJ do prestador inválido.');
  if (!onlyDigits(config.inscricao_municipal)) p.push('Inscrição municipal do prestador não informada.');
  if (onlyDigits(config.codigo_municipio).length !== 7) p.push('Código IBGE do município do prestador não informado.');
  if (!srv.item_lista_servico) p.push('Item da lista de serviço (LC 116) não informado.');
  if (srv.valor_servicos <= 0) p.push('Valor dos serviços deve ser maior que zero.');
  if (!srv.discriminacao?.trim()) p.push('Discriminação do serviço não informada.');
  const cli = os.clientes;
  if (!cli) { p.push('A OS precisa ter um cliente cadastrado.'); return p; }
  if (![11, 14].includes(onlyDigits(cli.cpf_cnpj).length)) p.push('CPF/CNPJ do tomador inválido.');
  if (!cli.endereco) p.push('Tomador sem logradouro.');
  if (!cli.bairro) p.push('Tomador sem bairro.');
  if (onlyDigits(cli.codigo_municipio).length !== 7) p.push('Tomador sem código IBGE do município.');
  if (!cli.estado) p.push('Tomador sem UF.');
  if (onlyDigits(cli.cep).length !== 8) p.push('CEP do tomador inválido.');
  return p;
}

async function applyResult(admin: any, config: any, nf: any, data: any) {
  const status = mapStatus(data?.status);
  const patch: Record<string, unknown> = { status, payload_retorno: data };
  if (status === 'autorizado') {
    Object.assign(patch, {
      numero: data.numero ? String(data.numero) : nf.numero,
      chave_acesso: data.codigo_verificacao || nf.chave_acesso,
      xml_url: absoluteUrl(config, data.caminho_xml_nota_fiscal),
      pdf_url: data.url_danfse || data.url || absoluteUrl(config, data.caminho_pdf_nota_fiscal),
      emitida_em: new Date().toISOString(), motivo_rejeicao: null,
    });
  } else if (status === 'rejeitado') patch.motivo_rejeicao = focusErrorMessage(data);
  const { data: updated } = await admin.from('nota_fiscal_emitida').update(patch).eq('id', nf.id).select().single();
  if (status !== nf.status && status !== 'processando') {
    await admin.from('nota_fiscal_eventos').insert({
      nf_id: nf.id, tipo_evento: status === 'autorizado' ? 'autorizacao' : status,
      descricao: status === 'autorizado' ? 'NFS-e autorizada pela prefeitura' : (patch.motivo_rejeicao as string), dados_evento: data,
    });
    if (status === 'autorizado' && nf.os_id) {
      await admin.from('ordens_servico').update({ nfe_emitida: true, nfse_numero: patch.numero }).eq('id', nf.os_id);
    }
  }
  return updated || { ...nf, ...patch };
}
