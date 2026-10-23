import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { focusErrorMessage, focusRequest } from '../_shared/focus-nfe.ts';

const Body = z.object({
  nf_id: z.string().uuid(),
  motivo: z.string().trim().min(15, 'A justificativa deve ter pelo menos 15 caracteres').max(255),
});

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
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin');
    if (!roles?.length) return json({ error: 'Apenas administradores podem cancelar notas fiscais' }, 403);
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    if (!profile?.organization_id) return json({ error: 'Usuário sem empresa vinculada' }, 400);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] || 'Requisição inválida';
      return json({ error: msg }, 400);
    }
    const { nf_id, motivo } = parsed.data;

    const { data: nf } = await admin.from('nota_fiscal_emitida').select('*')
      .eq('id', nf_id).eq('organization_id', profile.organization_id).maybeSingle();
    if (!nf) return json({ error: 'Nota fiscal não encontrada' }, 404);
    if (nf.status !== 'autorizado') return json({ error: 'Somente notas autorizadas podem ser canceladas' }, 400);

    const { data: config } = await admin.from('nfe_config').select('*').eq('organization_id', profile.organization_id).maybeSingle();
    if (!config) return json({ error: 'Configuração fiscal não encontrada' }, 400);
    const cfg = { ...config, ambiente: nf.ambiente };

    const rota = nf.tipo === 'nfse' ? 'nfse' : 'nfe';
    const r = await focusRequest(cfg, 'DELETE', `/v2/${rota}/${encodeURIComponent(nf.referencia)}`, { justificativa: motivo });
    if (!r.ok || (r.data?.status && r.data.status !== 'cancelado')) {
      return json({ error: focusErrorMessage(r.data) }, 422);
    }

    await admin.from('nota_fiscal_emitida').update({
      status: 'cancelado', cancelada_em: new Date().toISOString(), cancelada_por: userId, payload_retorno: r.data,
    }).eq('id', nf_id);
    await admin.from('nota_fiscal_eventos').insert({ nf_id, tipo_evento: 'cancelamento', descricao: motivo, dados_evento: r.data });
    if (nf.venda_id) {
      await admin.from('vendas').update({ nf_numero: null, nf_chave: null, nf_emitida_em: null, nf_provider: null }).eq('id', nf.venda_id);
    }
    if (nf.tipo === 'nfse' && nf.os_id) {
      await admin.from('ordens_servico').update({ nfe_emitida: false, nfse_numero: null }).eq('id', nf.os_id);
    }
    return json({ success: true });
  } catch (e: any) {
    console.error('cancelar-nota-fiscal', e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});
