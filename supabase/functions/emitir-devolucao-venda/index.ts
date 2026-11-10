// Emite NF-e de entrada (tipo 0, finalidade 4) para devolução de venda, referenciando a NF-e de venda autorizada.
// O saldo devolvido e o estoque só mudam depois que a SEFAZ autoriza (na consulta ou no aviso da Focus).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { absoluteUrl, dataEmissaoBrasil, focusErrorMessage, focusRequest, focusToken, mapStatus, onlyDigits } from '../_shared/focus-nfe.ts';
import { entradaEstoqueDevolucaoVenda } from '../_shared/devolucao-estoque.ts';

const Body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('emitir'),
    nota_origem_id: z.string().uuid(),
    itens: z.array(z.object({ venda_item_id: z.string().uuid(), quantidade: z.number().positive() })).min(1).max(200),
    motivo: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal('consultar'), nf_id: z.string().uuid() }),
]);

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin');
    if (!roles?.length) return json({ error: 'Apenas administradores podem emitir devolução de venda.' }, 403);
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) return json({ error: 'Usuário sem empresa vinculada' }, 400);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Requisição inválida', detalhes: parsed.error.flatten().fieldErrors }, 400);

    const { data: config } = await admin.from('nfe_config').select('*').eq('organization_id', orgId).maybeSingle();
    if (!config || !focusToken(config)) return json({ error: 'Configure a NF-e (token da Focus) antes de emitir a devolução.' }, 400);

    if (parsed.data.action === 'consultar') {
      const { data: nf } = await admin.from('nota_fiscal_emitida').select('*').eq('id', parsed.data.nf_id).eq('organization_id', orgId).maybeSingle();
      if (!nf) return json({ error: 'Nota não encontrada' }, 404);
      const cfg = { ...config, ambiente: nf.ambiente };
      const r = await focusRequest(cfg, 'GET', `/v2/nfe/${encodeURIComponent(nf.referencia)}`);
      const status = mapStatus(r.data?.status);
      const patch: Record<string, unknown> = { status, payload_retorno: r.data };
      if (status === 'autorizado') Object.assign(patch, {
        numero: r.data.numero ? String(r.data.numero) : nf.numero, serie: r.data.serie ? String(r.data.serie) : nf.serie,
        chave_acesso: r.data.chave_nfe ? String(r.data.chave_nfe).replace(/^NFe/, '') : nf.chave_acesso,
        protocolo: r.data.protocolo || null, xml_url: absoluteUrl(cfg, r.data.caminho_xml_nota_fiscal),
        pdf_url: absoluteUrl(cfg, r.data.caminho_danfe), emitida_em: new Date().toISOString(), motivo_rejeicao: null,
      });
      else if (status === 'rejeitado' || status === 'denegado') patch.motivo_rejeicao = focusErrorMessage(r.data);
      const { data: updated } = await admin.from('nota_fiscal_emitida').update(patch).eq('id', nf.id).select().single();
      if (status === 'autorizado') await entradaEstoqueDevolucaoVenda(admin, nf.id, userId);
      return json({ success: true, nf: updated });
    }

    const { nota_origem_id, itens, motivo } = parsed.data;
    const { data: origem } = await admin.from('nota_fiscal_emitida').select('*').eq('id', nota_origem_id).eq('organization_id', orgId).maybeSingle();
    if (!origem) return json({ error: 'Nota de venda não encontrada' }, 404);
    if (origem.tipo !== 'nfe' || !origem.venda_id) return json({ error: 'A nota escolhida não é uma NF-e de venda.' }, 422);
    if (origem.status !== 'autorizado') return json({ error: 'A nota de venda precisa estar autorizada para ser devolvida.' }, 422);
    if (onlyDigits(origem.chave_acesso).length !== 44) return json({ error: 'A nota de venda não tem chave de acesso para referenciar.' }, 422);

    const { data: venda } = await admin.from('vendas').select('*, venda_itens(*), clientes!vendas_cliente_id_fkey(*)')
      .eq('id', origem.venda_id).eq('organization_id', orgId).maybeSingle();
    if (!venda) return json({ error: 'Venda da nota não encontrada' }, 404);
    const cli = venda.clientes;

    const problemas: string[] = [];
    const doc = onlyDigits(venda.cliente_cpf_cnpj || cli?.cpf_cnpj);
    if (![11, 14].includes(doc.length)) problemas.push('CPF/CNPJ do cliente inválido.');
    if (!cli || !cli.endereco || !cli.bairro || !cli.cidade || !cli.estado) problemas.push('Endereço do cliente incompleto.');
    if (onlyDigits(cli?.cep).length !== 8) problemas.push('CEP do cliente inválido.');
    if (!config.uf) problemas.push('UF da empresa não configurada.');

    const interestadual = String(cli?.estado || '').toUpperCase() !== String(config.uf || '').toUpperCase();
    const { data: regra } = await admin.from('fiscal_regras').select('*').eq('organization_id', orgId).eq('tipo_operacao', 'devolucao_venda').maybeSingle();
    const cfop = regra ? String((interestadual ? regra.cfop_outra_uf : regra.cfop_mesma_uf) || regra.cfop || '') : '';
    if (!regra) problemas.push('Regra fiscal de devolução de venda não cadastrada.');
    else if (regra.status !== 'aprovado') problemas.push('A regra fiscal de devolução de venda ainda aguarda validação do contador.');
    else if (!/^\d{4}$/.test(cfop)) problemas.push('A regra fiscal de devolução de venda não tem CFOP para esta operação.');

    const { data: pend } = await admin.from('devolucoes_venda').select('id, nota_fiscal_emitida!devolucoes_venda_nf_id_fkey!inner(status)')
      .eq('nota_origem_id', nota_origem_id).eq('nota_fiscal_emitida.status', 'processando').limit(1);
    if (pend?.length) return json({ error: 'Já existe uma devolução em processamento para esta nota.' }, 409);

    const mapa = new Map((venda.venda_itens || []).map((i: any) => [i.id, i]));
    const ids = (venda.venda_itens || []).map((i: any) => i.produto_id).filter(Boolean);
    const { data: estoque } = ids.length ? await admin.from('itens_estoque').select('*').eq('organization_id', orgId).in('id', ids) : { data: [] };
    const estMap = new Map((estoque || []).map((e: any) => [e.id, e]));
    const linhas = itens.map((sel) => {
      const it: any = mapa.get(sel.venda_item_id);
      if (!it) { problemas.push('Item não pertence a esta venda.'); return null; }
      const saldo = Number(it.quantidade) - Number(it.quantidade_devolvida || 0);
      if (sel.quantidade > saldo + 1e-9) problemas.push(`${it.nome_produto}: quantidade maior que o saldo disponível (${saldo}).`);
      const e: any = estMap.get(it.produto_id) || {};
      if (onlyDigits(e.ncm || it.ncm).length !== 8) problemas.push(`${it.nome_produto}: NCM com 8 dígitos é obrigatório.`);
      return { it, e, quantidade: sel.quantidade };
    }).filter(Boolean) as { it: any; e: any; quantidade: number }[];
    if (problemas.length) return json({ error: 'Não é possível emitir a devolução', problemas }, 422);

    const simples = config.regime_tributario === 1 || config.regime_tributario === 2;
    const items = linhas.map(({ it, e, quantidade }, idx) => {
      const unit = Number(it.preco_unitario);
      return {
        numero_item: idx + 1, codigo_produto: e.codigo || `ITEM${idx + 1}`, descricao: it.nome_produto,
        codigo_ncm: onlyDigits(e.ncm || it.ncm), cfop, unidade_comercial: e.unidade || 'UN', unidade_tributavel: e.unidade || 'UN',
        quantidade_comercial: quantidade, quantidade_tributavel: quantidade,
        valor_unitario_comercial: unit, valor_unitario_tributavel: unit,
        valor_bruto: Number((quantidade * unit).toFixed(2)), inclui_no_total: 1,
        codigo_barras_comercial: e.gtin || 'SEM GTIN', codigo_barras_tributavel: e.gtin || 'SEM GTIN', icms_origem: Number(e.origem ?? 0),
        icms_situacao_tributaria: simples ? (regra!.csosn || '900') : (regra!.cst_icms || '90'),
        pis_situacao_tributaria: regra!.cst_pis || (simples ? '49' : '98'),
        cofins_situacao_tributaria: regra!.cst_cofins || (simples ? '49' : '98'),
      };
    });
    const total = Number(items.reduce((s, i) => s + i.valor_bruto, 0).toFixed(2));
    const chaveOrigem = onlyDigits(origem.chave_acesso);

    const payload = {
      natureza_operacao: 'Devolução de venda', data_emissao: dataEmissaoBrasil(), tipo_documento: 0, finalidade_emissao: 4,
      local_destino: interestadual ? 2 : 1, consumidor_final: cli?.indicador_ie === 1 ? 0 : 1, presenca_comprador: 9, serie: config.serie || 1,
      notas_referenciadas: [{ chave_nfe: chaveOrigem }],
      cnpj_emitente: onlyDigits(config.cnpj), nome_emitente: config.razao_social || undefined,
      inscricao_estadual_emitente: onlyDigits(config.inscricao_estadual), logradouro_emitente: config.logradouro,
      numero_emitente: config.numero, bairro_emitente: config.bairro, municipio_emitente: config.municipio,
      uf_emitente: config.uf, cep_emitente: onlyDigits(config.cep), regime_tributario_emitente: config.regime_tributario,
      nome_destinatario: config.ambiente === 'homologacao' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : (cli?.nome || venda.cliente_nome),
      ...(doc.length === 14 ? { cnpj_destinatario: doc } : { cpf_destinatario: doc }),
      indicador_inscricao_estadual_destinatario: cli?.indicador_ie ?? 9,
      ...(cli?.inscricao_estadual ? { inscricao_estadual_destinatario: onlyDigits(cli.inscricao_estadual) } : {}),
      logradouro_destinatario: cli.endereco, numero_destinatario: cli.numero || 'S/N', bairro_destinatario: cli.bairro,
      municipio_destinatario: cli.cidade, uf_destinatario: String(cli.estado).toUpperCase(), cep_destinatario: onlyDigits(cli.cep),
      pais_destinatario: 'Brasil', modalidade_frete: 9,
      formas_pagamento: [{ forma_pagamento: '90', valor_pagamento: 0 }],
      informacoes_adicionais_contribuinte: [`Devolução referente à NF-e ${origem.numero}, chave ${chaveOrigem}.`, motivo].filter(Boolean).join(' '),
      items,
    };

    const referencia = `${orgId.slice(0, 8)}-devvenda-${origem.numero}-${Date.now()}`;
    // venda_id fica vazio de propósito: o aviso da Focus grava o número da nota na venda quando venda_id existe.
    const { data: nf, error: nfErr } = await admin.from('nota_fiscal_emitida').insert({
      organization_id: orgId, tipo: 'nfe', ambiente: config.ambiente, referencia, cliente_id: venda.cliente_id,
      cliente_nome: cli?.nome || venda.cliente_nome, cliente_cpf_cnpj: doc, valor_total: total, valor_liquido: total,
      status: 'processando', provider: 'focusnfe', provider_id: referencia, payload_envio: payload, emitida_por: userId,
      tipo_operacao: 'devolucao_venda', nota_origem_id,
    }).select().single();
    if (nfErr) throw nfErr;

    await admin.from('devolucoes_venda').insert({
      organization_id: orgId, venda_id: venda.id, nota_origem_id, nf_id: nf.id, valor_total: total, motivo: motivo || null, created_by: userId,
      itens: linhas.map(({ it, quantidade }) => ({ venda_item_id: it.id, item_estoque_id: it.produto_id, quantidade })),
    });

    const r = await focusRequest(config, 'POST', `/v2/nfe?ref=${encodeURIComponent(referencia)}`, payload);
    if (!r.ok && r.status !== 202) {
      await admin.from('nota_fiscal_emitida').update({ status: 'rejeitado', motivo_rejeicao: focusErrorMessage(r.data), payload_retorno: r.data }).eq('id', nf.id);
      return json({ error: focusErrorMessage(r.data), nf_id: nf.id }, 400);
    }
    return json({ success: true, nf_id: nf.id, status: 'processando' });
  } catch (e: any) {
    console.error('emitir-devolucao-venda', e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});
