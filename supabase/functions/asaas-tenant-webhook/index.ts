// Webhook do Asaas para cobranças emitidas pelas oficinas (tenants).
// Escuta PAYMENT_RECEIVED / PAYMENT_CONFIRMED e marca a fatura local como paga.
import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (secret && (req.headers.get('x-webhook-secret') || '') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

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
        // Escopa à tabela correta: OS ou orçamento (nunca atualiza os dois).
        const { data: os } = await admin.from('ordens_servico').select('id').eq('id', ref).maybeSingle();
        if (os) {
          await admin.from('ordens_servico').update({ status: 'finalizada' }).eq('id', ref);
        } else {
          await admin.from('orcamentos').update({ status: 'aprovado' }).eq('id', ref);
        }
      }
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
