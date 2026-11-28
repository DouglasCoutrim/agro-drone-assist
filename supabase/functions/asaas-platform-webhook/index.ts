// Webhook do Asaas Master — recebe confirmação de pagamento das mensalidades dos tenants
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('WEBHOOK_SECRET');
  {
    const provided = req.headers.get('x-webhook-secret') || req.headers.get('asaas-access-token') || '';
    if (!secret || provided !== secret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      });
    }
  }

  try {
    const payload = await req.json();
    const event = payload?.event;
    const payment = payload?.payment;
    if (!payment) return new Response('no payment', { headers: corsHeaders });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const webhookEventId = String(payload?.id || `${event}:${payment.id}:${payment.status || ''}`);
    const { data: registeredEvent, error: eventError } = await admin.from('payment_webhook_events').insert({
      event_id: webhookEventId,
      event_type: event || 'unknown',
      asaas_payment_id: payment.id || null,
      payload_hash: webhookEventId,
      status: 'processing',
    }).select('id').maybeSingle();
    if (eventError?.code === '23505') {
      return new Response(JSON.stringify({ ok: true, idempotent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (eventError) throw eventError;

    // Find invoice by asaas_charge_id OR externalReference
    let { data: invoice } = await admin
      .from('tenant_invoices')
      .select('*')
      .eq('asaas_charge_id', payment.id)
      .maybeSingle();

    if (!invoice && payment.externalReference?.startsWith('tenant:')) {
      const [, orgId, competencia] = payment.externalReference.split(':');
      const { data } = await admin.from('tenant_invoices')
        .select('*').eq('organization_id', orgId).eq('competencia', competencia).maybeSingle();
      invoice = data;
    }
    if (!invoice) {
      await admin.from('payment_webhook_events').update({ status: 'failed', error_message: 'invoice not found' }).eq('id', registeredEvent?.id);
      return new Response('invoice not found', { headers: corsHeaders });
    }

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      if (invoice.status === 'pago') {
        await admin.from('payment_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', registeredEvent?.id);
        return new Response(JSON.stringify({ ok: true, idempotent: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await admin.from('tenant_invoices').update({
        status: 'pago', pago_em: new Date().toISOString(),
        asaas_charge_id: payment.id, last_webhook_event: webhookEventId,
      }).eq('id', invoice.id);
      if (invoice.checkout_session_id) {
        await admin.from('checkout_sessions').update({
          status: 'paid', completed_at: new Date().toISOString(), asaas_charge_id: payment.id,
        }).eq('id', invoice.checkout_session_id);
      }

      // Advance next_due_date according to the purchased billing cycle and unblock.
      const { data: organization } = await admin.from('organizations')
        .select('billing_cycle')
        .eq('id', invoice.organization_id)
        .maybeSingle();
      const next = new Date();
      const cycleMonths = organization?.billing_cycle === 'anual' ? 12 : organization?.billing_cycle === 'semestral' ? 6 : 1;
      next.setMonth(next.getMonth() + cycleMonths);
      await admin.from('organizations').update({
        status: 'active', blocked_at: null, blocked_reason: null,
        next_due_date: next.toISOString().slice(0, 10),
      }).eq('id', invoice.organization_id);
    } else if (event === 'PAYMENT_OVERDUE') {
      await admin.from('tenant_invoices').update({ status: 'vencido', last_webhook_event: webhookEventId }).eq('id', invoice.id);
    }

    await admin.from('payment_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', registeredEvent?.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
