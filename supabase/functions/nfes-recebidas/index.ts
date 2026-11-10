// Notas fiscais emitidas contra o CNPJ da empresa (Focus NFe – NF-e Recebidas / MDe)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { focusBaseUrl, focusErrorMessage, focusRequest, focusToken, onlyDigits } from '../_shared/focus-nfe.ts';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sincronizar') }),
  z.object({ action: z.literal('listar'), inicio: data, fim: data }),
  z.object({ action: z.literal('buscar_chave'), chave: z.string().regex(/^\d{44}$/) }),
  z.object({ action: z.literal('xml'), chave: z.string().regex(/^\d{44}$/), confirmar_ciencia: z.boolean().optional() }),
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
    if (!roles?.length) return json({ error: 'Apenas administradores podem buscar notas recebidas.' }, 403);
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    const orgId = profile?.organization_id;
    if (!orgId) return json({ error: 'Usuário sem empresa vinculada' }, 400);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Requisição inválida', detalhes: parsed.error.flatten().fieldErrors }, 400);

    // Listagem: lê só do banco, sem chamar a SEFAZ
    if (parsed.data.action === 'listar') {
      const { inicio, fim } = parsed.data;
      const { data: notas, error } = await admin.from('notas_recebidas')
        .select('chave_acesso,numero,nome_emitente,cnpj_emitente,data_emissao,valor_total,situacao_sefaz,manifestacao_destinatario,tem_xml,importada,nota_compra_id')
        .eq('organization_id', orgId).gte('data_emissao', inicio).lt('data_emissao', `${fim}T23:59:59.999`)
        .order('data_emissao', { ascending: false }).limit(500);
      if (error) return json({ error: error.message }, 400);
      const { data: sinc } = await admin.from('sincronizacao_nfe_recebidas').select('ultima_consulta').eq('organization_id', orgId).maybeSingle();
      return json({ notas: notas || [], ultima_sincronizacao: sinc?.ultima_consulta ?? null });
    }

    const { data: config } = await admin.from('nfe_config').select('*').eq('organization_id', orgId).maybeSingle();
    if (!config) return json({ error: 'Configure a NF-e (Fiscal → Configuração NF-e) antes de buscar notas.' }, 400);
    const cnpj = onlyDigits(config.cnpj);
    if (cnpj.length !== 14) return json({ error: 'CNPJ da empresa inválido na configuração fiscal.' }, 400);
    const token = focusToken(config);
    if (!token) return json({ error: 'Token da Focus NFe não configurado.' }, 400);

    // Sincronização incremental a partir da última versão gravada
    if (parsed.data.action === 'sincronizar') {
      const { data: sinc } = await admin.from('sincronizacao_nfe_recebidas').select('ultima_versao').eq('organization_id', orgId).maybeSingle();
      let versao = Number(sinc?.ultima_versao) || 0;
      let novas = 0;
      for (let page = 0; page < 20; page++) {
        const r = await focusRequest(config, 'GET', `/v2/nfes_recebidas?cnpj=${cnpj}&versao=${versao}`);
        if (!r.ok) {
          await admin.from('sincronizacao_nfe_recebidas').upsert({ organization_id: orgId, ultima_versao: versao, ultima_consulta: new Date().toISOString(), status: 'erro', updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
          return json({ error: focusErrorMessage(r.data) }, 400);
        }
        const lista = Array.isArray(r.data) ? r.data : [];
        if (!lista.length) break;
        const rows = lista.filter((n: any) => n.chave_nfe).map((n: any) => ({
          organization_id: orgId, chave_acesso: n.chave_nfe, numero: String(n.numero ?? n.chave_nfe.slice(25, 34)),
          serie: n.serie ? String(n.serie) : null, data_emissao: n.data_emissao || null,
          cnpj_emitente: onlyDigits(n.documento_emitente || '').slice(0, 14) || null, nome_emitente: n.nome_emitente || null,
          valor_total: Number(n.valor_total) || 0, situacao_sefaz: n.situacao || null,
          manifestacao_destinatario: n.manifestacao_destinatario || 'sem_manifestacao',
          tem_xml: n.nfe_completa === true || n.nfe_completa === 'true', updated_at: new Date().toISOString(),
        }));
        if (rows.length) {
          const { error } = await admin.from('notas_recebidas').upsert(rows, { onConflict: 'organization_id,chave_acesso' });
          if (error) return json({ error: error.message }, 400);
          novas += rows.length;
        }
        const maior = Math.max(...lista.map((n: any) => Number(n.versao) || 0));
        if (maior <= versao) break;
        versao = maior;
        if (lista.length < 100) break;
      }
      await admin.from('sincronizacao_nfe_recebidas').upsert({ organization_id: orgId, ultima_versao: versao, ultima_consulta: new Date().toISOString(), status: 'sucesso', updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
      return json({ atualizadas: novas });
    }

    // Busca por chave: usa o registro salvo ou consulta a Focus e grava a nota recebida
    const campos = 'chave_acesso,numero,nome_emitente,cnpj_emitente,data_emissao,valor_total,situacao_sefaz,manifestacao_destinatario,tem_xml,importada,nota_compra_id';
    if (parsed.data.action === 'buscar_chave') {
      const chaveBusca = parsed.data.chave;
      const { data: salva } = await admin.from('notas_recebidas').select(campos).eq('organization_id', orgId).eq('chave_acesso', chaveBusca).maybeSingle();
      if (salva) return json({ nota: salva });
      const r = await focusRequest(config, 'GET', `/v2/nfes_recebidas/${chaveBusca}.json`);
      if (r.status === 404) return json({ error: 'Nota não encontrada. A SEFAZ só disponibiliza notas emitidas para o CNPJ da sua empresa.' }, 404);
      if (!r.ok) return json({ error: focusErrorMessage(r.data) }, 400);
      const n: any = r.data || {};
      const dest = onlyDigits(n.documento_destinatario || n.cnpj_destinatario || '');
      if (dest && dest !== cnpj) return json({ error: 'Esta nota não foi emitida para o CNPJ da sua empresa.' }, 403);
      const row = {
        organization_id: orgId, chave_acesso: chaveBusca, numero: String(n.numero ?? chaveBusca.slice(25, 34)),
        serie: n.serie ? String(n.serie) : null, data_emissao: n.data_emissao || null,
        cnpj_emitente: onlyDigits(n.documento_emitente || n.cnpj_emitente || '').slice(0, 14) || null, nome_emitente: n.nome_emitente || null,
        valor_total: Number(n.valor_total) || 0, situacao_sefaz: n.situacao || null,
        manifestacao_destinatario: n.manifestacao_destinatario || 'sem_manifestacao',
        tem_xml: n.nfe_completa === true || n.nfe_completa === 'true', updated_at: new Date().toISOString(),
      };
      const { data: gravada, error } = await admin.from('notas_recebidas').upsert(row, { onConflict: 'organization_id,chave_acesso' }).select(campos).single();
      if (error) return json({ error: error.message }, 400);
      return json({ nota: gravada });
    }

    // Baixar XML: só registra ciência se o usuário confirmar
    const { chave, confirmar_ciencia } = parsed.data;
    const { data: registro } = await admin.from('notas_recebidas').select('id,xml_conteudo').eq('organization_id', orgId).eq('chave_acesso', chave).maybeSingle();
    if (!registro) return json({ error: 'Esta nota não consta entre as NF-e recebidas pela sua empresa. Sincronize com a SEFAZ.' }, 403);
    if (registro.xml_conteudo?.includes('<det')) return json({ xml: registro.xml_conteudo });

    const fetchXml = () => fetch(`${focusBaseUrl(config.ambiente)}/v2/nfes_recebidas/${chave}.xml`, { headers: { Authorization: `Basic ${btoa(`${token}:`)}` } });
    let res = await fetchXml();
    let xml = res.ok ? await res.text() : '';
    if (!xml.includes('<det')) {
      if (!confirmar_ciencia) return json({ precisa_ciencia: true, error: 'A SEFAZ exige registrar Ciência da Operação para liberar o XML completo.' });
      const m = await focusRequest(config, 'POST', `/v2/nfes_recebidas/${chave}/manifesto`, { tipo: 'ciencia' });
      if (!m.ok && m.status !== 422) return json({ error: `Não foi possível registrar a ciência: ${focusErrorMessage(m.data)}` }, 400);
      await admin.from('notas_recebidas').update({ manifestacao_destinatario: 'ciencia', updated_at: new Date().toISOString() }).eq('id', registro.id);
      res = await fetchXml();
      xml = res.ok ? await res.text() : '';
      if (!xml.includes('<det')) return json({ pendente: true, error: 'Ciência registrada. A SEFAZ ainda está liberando o XML completo; tente novamente em alguns minutos.' });
    }
    await admin.from('notas_recebidas').update({ xml_conteudo: xml, tem_xml: true, updated_at: new Date().toISOString() }).eq('id', registro.id);
    return json({ xml });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
