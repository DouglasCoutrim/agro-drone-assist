// Bloqueia tenants com faturas vencidas há mais de N dias (default 5)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const graceDays = 5;
    const cutoff = new Date(Date.now() - graceDays * 86400000).toISOString().slice(0, 10);

    // Faturas vencidas há +5 dias e não pagas
    const { data: overdue } = await admin
      .from('tenant_invoices')
      .select('organization_id, vencimento, valor, competencia')
      .in('status', ['pendente', 'vencido'])
      .lte('vencimento', cutoff);

    const orgIds = Array.from(new Set((overdue || []).map((i: any) => i.organization_id)));
    let blocked = 0;

    for (const orgId of orgIds) {
      const { data: org } = await admin.from('organizations').select('id, status').eq('id', orgId).maybeSingle();
      if (!org || org.status === 'blocked' || org.status === 'canceled') continue;
      await admin.from('organizations').update({
        status: 'blocked',
        blocked_at: new Date().toISOString(),
        blocked_reason: 'Mensalidade em atraso há mais de 5 dias',
      }).eq('id', orgId);
      blocked++;
    }

    // Também expira trials vencidos sem mensalidade
    const { data: expiredTrials } = await admin
      .from('organizations')
      .select('id')
      .eq('status', 'trial')
      .lt('trial_ends_at', new Date().toISOString());

    for (const t of expiredTrials || []) {
      await admin.from('organizations').update({
        status: 'blocked',
        blocked_at: new Date().toISOString(),
        blocked_reason: 'Período de teste expirado. Escolha um plano para continuar.',
      }).eq('id', t.id);
      blocked++;
    }

    return new Response(JSON.stringify({ ok: true, blocked, checked: orgIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
