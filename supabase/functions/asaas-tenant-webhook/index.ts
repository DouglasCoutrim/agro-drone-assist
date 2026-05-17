// Webhook do Asaas para cobranças emitidas pelas oficinas (tenants).
// Escuta PAYMENT_RECEIVED / PAYMENT_CONFIRMED e marca a fatura local como paga.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const event = body?.event;
    const payment = body?.payment;
    if (!event || !payment) return json({ ok: true });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const ref = payment.externalReference;
      if (ref) {
        // Atualiza a OS ou orçamento referenciado
        await admin.from('ordens_servico').update({ status: 'finalizada' }).eq('id', ref);
        await admin.from('orcamentos').update({ status: 'aprovado' }).eq('id', ref);
      }
      // Registra no financeiro (se identificarmos a org via externalReference)
      console.log(`[asaas-tenant-webhook] ${event}`, payment.id, ref);
    }

    return json({ received: true });
  } catch (e: any) {
    console.error('asaas-tenant-webhook error', e);
    return json({ error: e?.message ?? 'erro' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
