// Webhook do Asaas Master — recebe confirmação de pagamento das mensalidades dos tenants
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret) {
    const provided = req.headers.get('x-webhook-secret') || '';
    if (provided !== secret) {
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
    if (!invoice) return new Response('invoice not found', { headers: corsHeaders });

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      await admin.from('tenant_invoices').update({
        status: 'pago', pago_em: new Date().toISOString(),
        asaas_charge_id: payment.id,
      }).eq('id', invoice.id);

      // Advance next_due_date and unblock
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      await admin.from('organizations').update({
        status: 'active', blocked_at: null, blocked_reason: null,
        next_due_date: next.toISOString().slice(0, 10),
      }).eq('id', invoice.organization_id);
    } else if (event === 'PAYMENT_OVERDUE') {
      await admin.from('tenant_invoices').update({ status: 'vencido' }).eq('id', invoice.id);
    }

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
