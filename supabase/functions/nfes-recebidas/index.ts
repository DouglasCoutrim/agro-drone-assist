// Notas fiscais emitidas contra o CNPJ da empresa (Focus NFe – NF-e Recebidas / MDe)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { focusBaseUrl, focusErrorMessage, focusRequest, focusToken, onlyDigits } from '../_shared/focus-nfe.ts';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('listar'), inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal('xml'), chave: z.string().regex(/^\d{44}$/) }),
]);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

    const { data: config } = await admin.from('nfe_config').select('*').eq('organization_id', orgId).maybeSingle();
    if (!config) return json({ error: 'Configure a NF-e (Fiscal → Configuração NF-e) antes de buscar notas.' }, 400);
    const cnpj = onlyDigits(config.cnpj);
    if (cnpj.length !== 14) return json({ error: 'CNPJ da empresa inválido na configuração fiscal.' }, 400);
    const token = focusToken(config);
    if (!token) return json({ error: 'Token da Focus NFe não configurado.' }, 400);

    if (parsed.data.action === 'listar') {
      const { inicio, fim } = parsed.data;
      const notas: any[] = [];
      let versao = 0;
      for (let page = 0; page < 20; page++) {
        const r = await focusRequest(config, 'GET', `/v2/nfes_recebidas?cnpj=${cnpj}&versao=${versao}`);
        if (!r.ok) return json({ error: focusErrorMessage(r.data) }, 400);
        const lista = Array.isArray(r.data) ? r.data : [];
        if (!lista.length) break;
        notas.push(...lista);
        const maior = Math.max(...lista.map((n: any) => Number(n.versao) || 0));
        if (maior <= versao || lista.length < 100) break;
        versao = maior;
      }
      const filtradas = notas
        .filter((n) => { const d = String(n.data_emissao || '').slice(0, 10); return d >= inicio && d <= fim; })
        .map((n) => ({
          chave: n.chave_nfe, numero: n.numero ?? n.chave_nfe?.slice(25, 34), emitente: n.nome_emitente,
          documento_emitente: n.documento_emitente, data_emissao: n.data_emissao, valor_total: Number(n.valor_total) || 0,
          situacao: n.situacao, manifestacao: n.manifestacao_destinatario, completa: n.nfe_completa,
        }))
        .sort((a, b) => String(b.data_emissao).localeCompare(String(a.data_emissao)));
      return json({ notas: filtradas });
    }

    // Baixar XML: registra ciência da operação quando necessário (exigência da SEFAZ)
    const { chave } = parsed.data;
    const fetchXml = () => fetch(`${focusBaseUrl(config.ambiente)}/v2/nfes_recebidas/${chave}.xml`, { headers: { Authorization: `Basic ${btoa(`${token}:`)}` } });
    let res = await fetchXml();
    let xml = res.ok ? await res.text() : '';
    if (!res.ok || !xml.includes('<det')) {
      // Só manifesta notas que constem na lista de NF-e recebidas pelo CNPJ desta empresa.
      let encontrada = false;
      let versao = 0;
      for (let page = 0; page < 20 && !encontrada; page++) {
        const r = await focusRequest(config, 'GET', `/v2/nfes_recebidas?cnpj=${cnpj}&versao=${versao}`);
        if (!r.ok) return json({ error: focusErrorMessage(r.data) }, 400);
        const lista = Array.isArray(r.data) ? r.data : [];
        if (!lista.length) break;
        encontrada = lista.some((n: any) => n.chave_nfe === chave);
        const maior = Math.max(...lista.map((n: any) => Number(n.versao) || 0));
        if (maior <= versao || lista.length < 100) break;
        versao = maior;
      }
      if (!encontrada) return json({ error: 'Esta nota não consta entre as NF-e recebidas pela sua empresa.' }, 403);
      const m = await focusRequest(config, 'POST', `/v2/nfes_recebidas/${chave}/manifesto`, { tipo: 'ciencia' });
      if (!m.ok && m.status !== 422) return json({ error: `Não foi possível registrar a ciência: ${focusErrorMessage(m.data)}` }, 400);
      res = await fetchXml();
      xml = res.ok ? await res.text() : '';
      if (!xml.includes('<det')) return json({ pendente: true, error: 'Ciência registrada. A SEFAZ ainda está liberando o XML completo; tente novamente em alguns minutos.' });
    }
    return json({ xml });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
