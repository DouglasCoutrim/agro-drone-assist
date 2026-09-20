// Bloqueia tenants com faturas vencidas há mais de N dias (default 5)
// Verifica JWT + webhook secret (verify_jwt=true no config.toml)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeadersRestricted = { 'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersRestricted });

  // Verificar JWT para função protegida
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeadersRestricted });
  }

  // Verificar webhook secret para autorização adicional
  const secret = Deno.env.get('WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret') || '';
  if (secret && provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeadersRestricted });
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const graceDays = 5;
    const cutoff = new Date(Date.now() - graceDays * 86400000).toISOString().slice(0, 10);

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

      // Log de auditoria (Prompt 1.7)
      await admin.from('admin_audit_log').insert({
        action: 'tenant_blocked',
        organization_id: orgId,
        target_id: orgId,
        details: { reason: 'Mensalidade em atraso há mais de 5 dias', grace_days: graceDays },
        created_at: new Date().toISOString(),
      });
    }

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

      await admin.from('admin_audit_log').insert({
        action: 'trial_expired_blocked',
        organization_id: t.id,
        target_id: t.id,
        details: { reason: 'Trial expirado' },
        created_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true, blocked, checked: orgIds.length }), {
      headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
