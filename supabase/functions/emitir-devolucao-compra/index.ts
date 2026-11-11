// Emite NF-e de devolução de compra (finalidade 4) referenciando a nota de entrada.
// O estoque só sai depois que a SEFAZ autoriza (aqui na consulta ou no aviso da Focus).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { absoluteUrl, dataEmissaoBrasil, focusErrorMessage, focusRequest, focusToken, mapStatus, onlyDigits, withFocusToken } from '../_shared/focus-nfe.ts';
import { baixarEstoqueDevolucao } from '../_shared/devolucao-estoque.ts';

const Body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('emitir'),
    nota_compra_id: z.string().uuid(),
    itens: z.array(z.object({ nota_compra_item_id: z.string().uuid(), quantidade: z.number().positive() })).min(1).max(200),
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
    if (!roles?.length) return json({ error: 'Apenas administradores podem emitir devolução de compra.' }, 403);
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) return json({ error: 'Usuário sem empresa vinculada' }, 400);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Requisição inválida', detalhes: parsed.error.flatten().fieldErrors }, 400);

    const { data: configRaw } = await admin.from('nfe_config').select('*').eq('organization_id', orgId).maybeSingle();
    const config = await withFocusToken(admin, configRaw);
    if (!config || !focusToken(config)) return json({ error: 'Configure a NF-e (token da Focus) antes de emitir a devolução.' }, 400);

    if (parsed.data.action === 'consultar') {
      const { data: nf } = await admin.from('nota_fiscal_emitida').select('*').eq('id', parsed.data.nf_id).eq('organization_id', orgId).maybeSingle();
      if (!nf) return json({ error: 'Nota não encontrada' }, 404);
      const cfg = await withFocusToken(admin, { ...config, ambiente: nf.ambiente });
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
      if (status === 'autorizado') await baixarEstoqueDevolucao(admin, nf.id, userId);
      return json({ success: true, nf: updated });
    }

    const { nota_compra_id, itens, motivo } = parsed.data;
    const { data: nc } = await admin.from('notas_compra').select('*, notas_compra_itens(*)').eq('id', nota_compra_id).eq('organization_id', orgId).maybeSingle();
    if (!nc) return json({ error: 'Nota de compra não encontrada' }, 404);
    if (!nc.chave_acesso || onlyDigits(nc.chave_acesso).length !== 44) return json({ error: 'A nota de compra não tem chave de acesso para referenciar.' }, 422);
    if (!nc.fornecedor_id) return json({ error: 'A nota de compra não está vinculada a um fornecedor cadastrado.' }, 422);
    const { data: forn } = await admin.from('fornecedores').select('*').eq('id', nc.fornecedor_id).eq('organization_id', orgId).maybeSingle();
    if (!forn) return json({ error: 'Fornecedor não encontrado' }, 404);

    const problemas: string[] = [];
    const docForn = onlyDigits(forn.cpf_cnpj);
    if (![11, 14].includes(docForn.length)) problemas.push('CPF/CNPJ do fornecedor inválido.');
    if (!forn.endereco || !forn.bairro || !forn.cidade || !forn.estado) problemas.push('Endereço do fornecedor incompleto.');
    if (onlyDigits(forn.cep).length !== 8) problemas.push('CEP do fornecedor inválido.');
    if (!config.uf) problemas.push('UF da empresa não configurada.');

    const interestadual = String(forn.estado || '').toUpperCase() !== String(config.uf || '').toUpperCase();
    const tipoRegra = interestadual ? 'devolucao_compra_interestadual' : 'devolucao_compra_estadual';
    const { data: regra } = await admin.from('fiscal_regras').select('*').eq('organization_id', orgId).eq('tipo_operacao', tipoRegra).maybeSingle();
    if (!regra) problemas.push('Regra fiscal de devolução não cadastrada.');
    else if (regra.status !== 'aprovado') problemas.push(`A regra fiscal de devolução (CFOP ${regra.cfop}) ainda aguarda validação do contador.`);

    const mapa = new Map((nc.notas_compra_itens || []).map((i: any) => [i.id, i]));
    const linhas = itens.map((sel) => {
      const it: any = mapa.get(sel.nota_compra_item_id);
      if (!it) { problemas.push('Item não pertence a esta nota de compra.'); return null; }
      const saldo = Number(it.quantidade) - Number(it.quantidade_devolvida || 0);
      if (sel.quantidade > saldo + 1e-9) problemas.push(`${it.descricao}: quantidade maior que o saldo disponível (${saldo}).`);
      if (onlyDigits(it.ncm).length !== 8) problemas.push(`${it.descricao}: NCM com 8 dígitos é obrigatório.`);
      return { it, quantidade: sel.quantidade };
    }).filter(Boolean) as { it: any; quantidade: number }[];
    if (problemas.length) return json({ error: 'Não é possível emitir a devolução', problemas }, 422);

    const { data: pend } = await admin.from('devolucoes_compra').select('id, nota_fiscal_emitida!inner(status)')
      .eq('nota_compra_id', nota_compra_id).eq('nota_fiscal_emitida.status', 'processando').limit(1);
    if (pend?.length) return json({ error: 'Já existe uma devolução em processamento para esta nota.' }, 409);

    const simples = config.regime_tributario === 1 || config.regime_tributario === 2;
    const items = linhas.map(({ it, quantidade }, idx) => ({
      numero_item: idx + 1, codigo_produto: it.codigo_fornecedor || `ITEM${idx + 1}`, descricao: it.descricao,
      codigo_ncm: onlyDigits(it.ncm), cfop: regra!.cfop, unidade_comercial: it.unidade || 'UN', unidade_tributavel: it.unidade || 'UN',
      quantidade_comercial: quantidade, quantidade_tributavel: quantidade,
      valor_unitario_comercial: Number(it.valor_unitario), valor_unitario_tributavel: Number(it.valor_unitario),
      valor_bruto: Number((quantidade * Number(it.valor_unitario)).toFixed(2)), inclui_no_total: 1,
      codigo_barras_comercial: 'SEM GTIN', codigo_barras_tributavel: 'SEM GTIN', icms_origem: 0,
      icms_situacao_tributaria: simples ? (regra!.csosn_padrao || '900') : (regra!.cst_padrao || '90'),
      pis_situacao_tributaria: simples ? '49' : '99', cofins_situacao_tributaria: simples ? '49' : '99',
    }));
    const total = Number(items.reduce((s, i) => s + i.valor_bruto, 0).toFixed(2));

    const payload = {
      natureza_operacao: 'Devolução de compra', data_emissao: dataEmissaoBrasil(), tipo_documento: 1, finalidade_emissao: 4,
      local_destino: interestadual ? 2 : 1, consumidor_final: 0, presenca_comprador: 9, serie: config.serie || 1,
      notas_referenciadas: [{ chave_nfe: onlyDigits(nc.chave_acesso) }],
      cnpj_emitente: onlyDigits(config.cnpj), nome_emitente: config.razao_social || undefined,
      inscricao_estadual_emitente: onlyDigits(config.inscricao_estadual), logradouro_emitente: config.logradouro,
      numero_emitente: config.numero, bairro_emitente: config.bairro, municipio_emitente: config.municipio,
      uf_emitente: config.uf, cep_emitente: onlyDigits(config.cep), regime_tributario_emitente: config.regime_tributario,
      nome_destinatario: config.ambiente === 'homologacao' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : forn.nome,
      ...(docForn.length === 14 ? { cnpj_destinatario: docForn } : { cpf_destinatario: docForn }),
      indicador_inscricao_estadual_destinatario: forn.inscricao_estadual ? 1 : 9,
      ...(forn.inscricao_estadual ? { inscricao_estadual_destinatario: onlyDigits(forn.inscricao_estadual) } : {}),
      logradouro_destinatario: forn.endereco, numero_destinatario: forn.numero || 'S/N', bairro_destinatario: forn.bairro,
      municipio_destinatario: forn.cidade, uf_destinatario: String(forn.estado).toUpperCase(), cep_destinatario: onlyDigits(forn.cep),
      pais_destinatario: 'Brasil', modalidade_frete: 9,
      formas_pagamento: [{ forma_pagamento: '90', valor_pagamento: 0 }],
      informacoes_adicionais_contribuinte: [`Devolução referente à NF-e ${nc.numero}, chave ${onlyDigits(nc.chave_acesso)}.`, motivo].filter(Boolean).join(' '),
      items,
    };

    const referencia = `${orgId.slice(0, 8)}-devcompra-${nc.numero}-${Date.now()}`;
    const { data: nf, error: nfErr } = await admin.from('nota_fiscal_emitida').insert({
      organization_id: orgId, tipo: 'nfe', ambiente: config.ambiente, referencia,
      cliente_nome: forn.nome, cliente_cpf_cnpj: docForn, valor_total: total, valor_liquido: total,
      status: 'processando', provider: 'focusnfe', provider_id: referencia, payload_envio: payload, emitida_por: userId,
    }).select().single();
    if (nfErr) throw nfErr;

    await admin.from('devolucoes_compra').insert({
      organization_id: orgId, nota_compra_id, nf_id: nf.id, valor_total: total, created_by: userId,
      itens: linhas.map(({ it, quantidade }) => ({ nota_compra_item_id: it.id, item_estoque_id: it.item_estoque_id, quantidade })),
    });

    const r = await focusRequest(config, 'POST', `/v2/nfe?ref=${encodeURIComponent(referencia)}`, payload);
    if (!r.ok && r.status !== 202) {
      await admin.from('nota_fiscal_emitida').update({ status: 'rejeitado', motivo_rejeicao: focusErrorMessage(r.data), payload_retorno: r.data }).eq('id', nf.id);
      return json({ error: focusErrorMessage(r.data), nf_id: nf.id }, 400);
    }
    return json({ success: true, nf_id: nf.id, status: 'processando' });
  } catch (e: any) {
    console.error('emitir-devolucao-compra', e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});
