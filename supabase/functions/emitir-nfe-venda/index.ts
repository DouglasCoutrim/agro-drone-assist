import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { absoluteUrl, focusErrorMessage, focusRequest, focusToken, mapStatus, onlyDigits } from '../_shared/focus-nfe.ts';

const Body = z.object({
  action: z.enum(['validar', 'emitir', 'consultar', 'diagnosticar']).default('emitir'),
  venda_id: z.string().uuid().optional(),
  nf_id: z.string().uuid().optional(),
});

const FORMA_PAGAMENTO: Record<string, string> = {
  dinheiro: '01', cheque: '02', credito: '03', debito: '04', boleto: '15', pix: '17',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
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
    const { action, venda_id, nf_id } = parsed.data;

    const { data: config } = await admin.from('nfe_config').select('*').eq('organization_id', orgId).maybeSingle();

    // ---------- DIAGNOSTICAR ----------
    if (action === 'diagnosticar') {
      if (!config) return json({ success: false, itens: [{ ok: false, texto: 'Configuração fiscal não salva.' }] });
      const itens: { ok: boolean; texto: string }[] = [];
      const token = focusToken(config);
      itens.push({ ok: !!token, texto: token ? `Token de ${config.ambiente} informado.` : `Token de ${config.ambiente} não informado.` });
      if (token) {
        // Uma referência inexistente devolve 404 com token válido e 401/403 com token inválido.
        const t = await focusRequest(config, 'GET', `/v2/nfe/teste-conexao-livreos`);
        const tokenOk = t.status === 404 || t.ok;
        itens.push({ ok: tokenOk, texto: tokenOk ? 'Conexão com a Focus NFe funcionando e token aceito.' : `A Focus recusou o token (${focusErrorMessage(t.data)}).` });
        if (tokenOk) {
          const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/focus-webhook`;
          const hooks = await focusRequest(config, 'GET', '/v2/hooks');
          const lista = Array.isArray(hooks.data) ? hooks.data : [];
          for (const event of ['nfe', 'nfse']) {
            if (lista.some((h: any) => h.url === url && h.event === event)) {
              itens.push({ ok: true, texto: `Aviso automático de ${event.toUpperCase()} já ativo.` });
              continue;
            }
            const r = await focusRequest(config, 'POST', '/v2/hooks', { cnpj: onlyDigits(config.cnpj), event, url });
            itens.push({ ok: r.ok, texto: r.ok ? `Aviso automático de ${event.toUpperCase()} ativado.` : `Não foi possível ativar o aviso de ${event.toUpperCase()}: ${focusErrorMessage(r.data)}` });
          }
        }
      }
      const master = Deno.env.get('FOCUS_NFE_TOKEN_MASTER');
      if (master && onlyDigits(config.cnpj).length === 14) {
        const r = await fetch(`https://api.focusnfe.com.br/v2/empresas?cnpj=${onlyDigits(config.cnpj)}`, { headers: { Authorization: `Basic ${btoa(`${master}:`)}` } });
        const lista = await r.json().catch(() => []);
        const emp = Array.isArray(lista) ? lista[0] : null;
        if (!emp) itens.push({ ok: false, texto: 'CNPJ não encontrado na sua conta Focus NFe.' });
        else {
          itens.push({ ok: !!emp.habilita_nfe, texto: emp.habilita_nfe ? 'Emissão de NF-e liberada na Focus.' : 'Emissão de NF-e NÃO liberada na Focus.' });
          itens.push({ ok: !!(emp.habilita_nfse || emp.habilita_nfsen_producao || emp.habilita_nfsen_homologacao), texto: 'Emissão de NFS-e ' + ((emp.habilita_nfse || emp.habilita_nfsen_producao || emp.habilita_nfsen_homologacao) ? 'liberada' : 'NÃO liberada') + ' na Focus.' });
          const venc = emp.certificado_valido_ate;
          if (venc) itens.push({ ok: new Date(venc) > new Date(), texto: `Certificado digital válido até ${new Date(venc).toLocaleDateString('pt-BR')}.` });
        }
      }
      itens.push(...validar(config, { clientes: {}, venda_itens: [{ quantidade: 1, ncm: '00000000' }], cliente_cpf_cnpj: '00000000000' }, new Map())
        .filter((x) => !x.startsWith('Cliente') && !x.startsWith('CEP') && !x.startsWith('CPF'))
        .map((texto) => ({ ok: false, texto })));
      return json({ success: itens.every((i) => i.ok), itens });
    }

    // ---------- CONSULTAR ----------
    if (action === 'consultar') {
      if (!nf_id) return json({ error: 'nf_id é obrigatório' }, 400);
      if (!config) return json({ error: 'Configuração fiscal não encontrada' }, 400);
      const { data: nf } = await admin.from('nota_fiscal_emitida').select('*').eq('id', nf_id).eq('organization_id', orgId).maybeSingle();
      if (!nf) return json({ error: 'Nota não encontrada' }, 404);
      const cfg = { ...config, ambiente: nf.ambiente };
      const r = await focusRequest(cfg, 'GET', `/v2/nfe/${encodeURIComponent(nf.referencia)}`);
      const updated = await applyFocusResult(admin, cfg, nf, r.data);
      return json({ success: true, nf: updated });
    }

    if (!venda_id) return json({ error: 'venda_id é obrigatório' }, 400);
    const { data: venda } = await admin
      .from('vendas')
      .select('*, venda_itens(*), clientes!vendas_cliente_id_fkey(*)')
      .eq('id', venda_id).eq('organization_id', orgId).maybeSingle();
    if (!venda) return json({ error: 'Venda não encontrada' }, 404);

    const produtoIds = (venda.venda_itens || []).map((i: any) => i.produto_id).filter(Boolean);
    const { data: estoque } = produtoIds.length
      ? await admin.from('itens_estoque').select('*').in('id', produtoIds)
      : { data: [] as any[] };
    const estoqueMap = new Map((estoque || []).map((e: any) => [e.id, e]));

    const problemas = validar(config, venda, estoqueMap);
    if (action === 'validar') return json({ success: problemas.length === 0, problemas });
    if (problemas.length) return json({ error: 'Dados incompletos para emissão', problemas }, 422);

    // Já existe NF ativa?
    const { data: existente } = await admin.from('nota_fiscal_emitida').select('id,status')
      .eq('venda_id', venda_id).in('status', ['processando', 'autorizado']).maybeSingle();
    if (existente) return json({ error: existente.status === 'autorizado' ? 'Esta venda já possui NF-e autorizada' : 'Já existe uma NF-e em processamento para esta venda', nf_id: existente.id }, 409);

    const referencia = `${orgId.slice(0, 8)}-venda-${venda.numero}-${Date.now()}`;
    const nd = venda.nfe_dados || {};
    let transportadora: any = null;
    if (nd.por_transportadora && nd.transportadora_id) {
      const { data: t } = await admin.from('transportadoras').select('*').eq('id', nd.transportadora_id).eq('organization_id', orgId).maybeSingle();
      transportadora = t;
    }
    const payload = buildPayload(config, venda, estoqueMap, transportadora);

    const { data: nf, error: nfErr } = await admin.from('nota_fiscal_emitida').insert({
      organization_id: orgId, tipo: 'nfe', ambiente: config.ambiente, referencia,
      cliente_id: venda.cliente_id, cliente_nome: venda.cliente_nome, cliente_cpf_cnpj: venda.cliente_cpf_cnpj,
      cliente_email: venda.cliente_email, valor_total: venda.valor_total, valor_impostos: venda.valor_impostos,
      valor_liquido: Number(venda.valor_total) - Number(venda.valor_impostos || 0),
      status: 'processando', venda_id, provider: 'focusnfe', provider_id: referencia,
      payload_envio: payload, emitida_por: userId,
    }).select().single();
    if (nfErr) throw nfErr;

    await admin.from('nota_fiscal_itens').insert((venda.venda_itens || []).map((i: any) => ({
      nf_id: nf.id, descricao: i.nome_produto, quantidade: i.quantidade, valor_unitario: i.preco_unitario,
      valor_total: i.valor_total, ncm: estoqueMap.get(i.produto_id)?.ncm || i.ncm, cfop: payload.items.find((p: any) => p.descricao === i.nome_produto)?.cfop,
    })));

    const envio = await focusRequest(config, 'POST', `/v2/nfe?ref=${encodeURIComponent(referencia)}`, payload);
    if (!envio.ok) {
      const motivo = focusErrorMessage(envio.data);
      await admin.from('nota_fiscal_emitida').update({ status: 'rejeitado', motivo_rejeicao: motivo, payload_retorno: envio.data }).eq('id', nf.id);
      await admin.from('nota_fiscal_eventos').insert({ nf_id: nf.id, tipo_evento: 'rejeicao', descricao: motivo, dados_evento: envio.data });
      return json({ error: motivo, nf_id: nf.id }, 422);
    }

    // Consulta curta (processamento é assíncrono na SEFAZ)
    let atual = nf;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const c = await focusRequest(config, 'GET', `/v2/nfe/${encodeURIComponent(referencia)}`);
      atual = await applyFocusResult(admin, config, atual, c.data);
      if (atual.status !== 'processando') break;
    }
    if (atual.status === 'rejeitado' || atual.status === 'denegado') {
      return json({ error: atual.motivo_rejeicao || 'NF-e rejeitada pela SEFAZ', nf: atual }, 422);
    }
    return json({ success: true, nf: atual });
  } catch (e: any) {
    console.error('emitir-nfe-venda', e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});

async function applyFocusResult(admin: any, config: any, nf: any, data: any) {
  const status = mapStatus(data?.status);
  const patch: Record<string, unknown> = { status, payload_retorno: data };
  if (status === 'autorizado') {
    Object.assign(patch, {
      numero: data.numero ? String(data.numero) : nf.numero,
      serie: data.serie ? String(data.serie) : nf.serie,
      chave_acesso: data.chave_nfe ? String(data.chave_nfe).replace(/^NFe/, '') : nf.chave_acesso,
      protocolo: data.protocolo || null,
      xml_url: absoluteUrl(config, data.caminho_xml_nota_fiscal),
      pdf_url: absoluteUrl(config, data.caminho_danfe),
      emitida_em: new Date().toISOString(),
      motivo_rejeicao: null,
    });
  } else if (status === 'rejeitado' || status === 'denegado') {
    patch.motivo_rejeicao = focusErrorMessage(data);
  }
  const { data: updated } = await admin.from('nota_fiscal_emitida').update(patch).eq('id', nf.id).select().single();
  if (status !== nf.status && status !== 'processando') {
    await admin.from('nota_fiscal_eventos').insert({
      nf_id: nf.id, tipo_evento: status === 'autorizado' ? 'autorizacao' : status,
      descricao: status === 'autorizado' ? 'NF-e autorizada pela SEFAZ' : (patch.motivo_rejeicao as string),
      dados_evento: data,
    });
    if (status === 'autorizado' && nf.venda_id) {
      await admin.from('vendas').update({
        nf_numero: patch.numero, nf_chave: patch.chave_acesso, nf_emitida_em: patch.emitida_em, nf_provider: 'focusnfe',
      }).eq('id', nf.venda_id);
    }
  }
  return updated || { ...nf, ...patch };
}

function validar(config: any, venda: any, estoque: Map<string, any>): string[] {
  const p: string[] = [];
  if (!config) return ['Configure os dados fiscais da empresa em Empresa → Nota Fiscal (NF-e).'];
  if (!config.habilitado) p.push('A emissão de NF-e está desativada nas configurações fiscais.');
  if (!focusToken(config)) p.push(`Token da Focus NFe de ${config.ambiente === 'producao' ? 'produção' : 'homologação'} não informado.`);
  if (onlyDigits(config.cnpj).length !== 14) p.push('CNPJ do emitente inválido.');
  if (!config.inscricao_estadual) p.push('Inscrição estadual do emitente não informada.');
  for (const [k, l] of [['logradouro', 'logradouro'], ['numero', 'número'], ['bairro', 'bairro'], ['municipio', 'município'], ['uf', 'UF'], ['cep', 'CEP']]) {
    if (!config[k]) p.push(`Endereço do emitente sem ${l}.`);
  }

  const cli = venda.clientes;
  const doc = onlyDigits(venda.cliente_cpf_cnpj || cli?.cpf_cnpj);
  if (![11, 14].includes(doc.length)) p.push('CPF/CNPJ do cliente inválido ou não informado.');
  if (!cli) p.push('Vincule a venda a um cliente cadastrado (endereço é obrigatório na NF-e).');
  else {
    if (!cli.endereco) p.push('Cliente sem logradouro.');
    if (!cli.bairro) p.push('Cliente sem bairro.');
    if (!cli.cidade || !cli.estado) p.push('Cliente sem cidade/UF.');
    if (onlyDigits(cli.cep).length !== 8) p.push('CEP do cliente inválido.');
    if (doc.length === 14 && cli.indicador_ie === 1 && !cli.inscricao_estadual) p.push('Cliente contribuinte sem inscrição estadual.');
  }

  const itens = venda.venda_itens || [];
  if (!itens.length) p.push('A venda não possui itens.');
  itens.forEach((i: any, idx: number) => {
    const e = estoque.get(i.produto_id);
    if (e && e.emite_nfe === false) p.push(`Item ${idx + 1} (${i.nome_produto}): produto marcado como "sem nota fiscal" — remova-o da venda para emitir NF-e.`);
    const ncm = onlyDigits(e?.ncm || i.ncm);
    if (ncm.length !== 8) p.push(`Item ${idx + 1} (${i.nome_produto}): NCM com 8 dígitos é obrigatório.`);
    if (Number(i.quantidade) <= 0) p.push(`Item ${idx + 1}: quantidade inválida.`);
  });
  return p;
}

function buildPayload(config: any, venda: any, estoque: Map<string, any>, transp: any = null) {
  const nd = venda.nfe_dados || {};
  const cli = venda.clientes;
  const doc = onlyDigits(venda.cliente_cpf_cnpj || cli?.cpf_cnpj);
  const interestadual = (cli?.estado || '').toUpperCase() !== (config.uf || '').toUpperCase();
  const simples = config.regime_tributario === 1 || config.regime_tributario === 2;

  const items = (venda.venda_itens || []).map((i: any, idx: number) => {
    const e = estoque.get(i.produto_id) || {};
    let cfop = String(e.cfop || i.cfop || nd.cfop || '5102');
    if (interestadual && cfop.startsWith('5')) cfop = '6' + cfop.slice(1);
    const qtd = Number(i.quantidade);
    const unit = Number(i.preco_unitario);
    return {
      numero_item: idx + 1,
      codigo_produto: e.codigo || `ITEM${idx + 1}`,
      descricao: i.nome_produto,
      codigo_ncm: onlyDigits(e.ncm || i.ncm),
      ...(e.cest ? { cest: onlyDigits(e.cest) } : {}),
      codigo_barras_comercial: e.gtin || 'SEM GTIN',
      codigo_barras_tributavel: e.gtin || 'SEM GTIN',
      cfop,
      unidade_comercial: e.unidade || 'UN',
      unidade_tributavel: e.unidade || 'UN',
      quantidade_comercial: qtd,
      quantidade_tributavel: qtd,
      valor_unitario_comercial: unit,
      valor_unitario_tributavel: unit,
      valor_bruto: Number((qtd * unit).toFixed(2)),
      ...(Number(i.desconto_valor) > 0 ? { valor_desconto: Number(i.desconto_valor) } : {}),
      inclui_no_total: 1,
      icms_origem: Number(e.origem ?? 0),
      icms_situacao_tributaria: simples ? (e.csosn || nd.csosn || '102') : (e.cst_icms || '00'),
      pis_situacao_tributaria: simples ? '49' : '01',
      cofins_situacao_tributaria: simples ? '49' : '01',
    };
  });

  return {
    natureza_operacao: nd.natureza_operacao || config.natureza_operacao || 'Venda de mercadoria',
    data_emissao: new Date().toISOString(),
    tipo_documento: Number(nd.tipo ?? 1),
    finalidade_emissao: Number(nd.finalidade || 1),
    local_destino: interestadual ? 2 : 1,
    consumidor_final: nd.consumidor_final === undefined ? (cli?.indicador_ie === 1 ? 0 : 1) : (nd.consumidor_final ? 1 : 0),
    presenca_comprador: 1,
    serie: config.serie || 1,
    cnpj_emitente: onlyDigits(config.cnpj),
    nome_emitente: config.razao_social || undefined,
    inscricao_estadual_emitente: onlyDigits(config.inscricao_estadual),
    logradouro_emitente: config.logradouro,
    numero_emitente: config.numero,
    bairro_emitente: config.bairro,
    municipio_emitente: config.municipio,
    uf_emitente: config.uf,
    cep_emitente: onlyDigits(config.cep),
    regime_tributario_emitente: config.regime_tributario,
    nome_destinatario: config.ambiente === 'homologacao'
      ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : (cli?.nome || venda.cliente_nome),
    ...(doc.length === 14 ? { cnpj_destinatario: doc } : { cpf_destinatario: doc }),
    indicador_inscricao_estadual_destinatario: cli?.indicador_ie ?? 9,
    ...(cli?.inscricao_estadual ? { inscricao_estadual_destinatario: onlyDigits(cli.inscricao_estadual) } : {}),
    logradouro_destinatario: cli?.endereco,
    numero_destinatario: cli?.numero || 'S/N',
    ...(cli?.complemento ? { complemento_destinatario: cli.complemento } : {}),
    bairro_destinatario: cli?.bairro,
    municipio_destinatario: cli?.cidade,
    uf_destinatario: (cli?.estado || '').toUpperCase(),
    cep_destinatario: onlyDigits(cli?.cep),
    pais_destinatario: 'Brasil',
    ...(venda.cliente_email || cli?.email ? { email_destinatario: venda.cliente_email || cli?.email } : {}),
    ...(onlyDigits(cli?.telefone) ? { telefone_destinatario: onlyDigits(cli?.telefone) } : {}),
    modalidade_frete: Number(nd.modalidade_frete ?? 9),
    ...(transp ? (() => {
      const d = onlyDigits(transp.cpf_cnpj);
      return {
        ...(d.length === 14 ? { cnpj_transportador: d } : d.length === 11 ? { cpf_transportador: d } : {}),
        nome_transportador: transp.nome,
        ...(transp.inscricao_estadual ? { inscricao_estadual_transportador: onlyDigits(transp.inscricao_estadual) } : {}),
        ...(transp.endereco ? { endereco_transportador: [transp.endereco, transp.numero].filter(Boolean).join(', ') } : {}),
        ...(transp.cidade ? { municipio_transportador: transp.cidade } : {}),
        ...(transp.estado ? { uf_transportador: String(transp.estado).toUpperCase() } : {}),
      };
    })() : {}),
    ...(Number(venda.valor_desconto) > 0 ? { valor_desconto: Number(venda.valor_desconto) } : {}),
    ...parcelamento(venda, nd),
    informacoes_adicionais_contribuinte: [config.informacoes_complementares, nd.obs_complementares, venda.obs].filter(Boolean).join(' ') || undefined,
    items,
  };
}

function parcelamento(venda: any, nd: any) {
  const total = Number(venda.valor_total);
  const forma = FORMA_PAGAMENTO[venda.forma_pagamento] || '99';
  const n = nd.tipo_pagamento === '1' ? Math.max(1, Number(nd.parcelas || 1)) : 1;
  if (n === 1) return { formas_pagamento: [{ indicador_pagamento: nd.tipo_pagamento === '1' ? 1 : 0, forma_pagamento: forma, valor_pagamento: total }] };
  const base = Math.floor((total / n) * 100) / 100;
  const intervalo = Number(nd.intervalo_dias ?? 30);
  const duplicatas = Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + intervalo * (i + 1));
    const valor = i === n - 1 ? Number((total - base * (n - 1)).toFixed(2)) : base;
    return { numero: String(i + 1).padStart(3, '0'), data_vencimento: d.toISOString().slice(0, 10), valor };
  });
  return {
    formas_pagamento: [{ indicador_pagamento: 1, forma_pagamento: forma, valor_pagamento: total }],
    numero_fatura: String(venda.numero || '1'), valor_original_fatura: total, valor_liquido_fatura: total,
    duplicatas,
  };
}
