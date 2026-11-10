// Webhook do Asaas para cobranças emitidas pelas oficinas (tenants).
// Escuta PAYMENT_RECEIVED / PAYMENT_CONFIRMED e marca a fatura local como paga.
// verify_jwt=true no config.toml - requer autenticação JWT.

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'npm:@supabase/supabase-js@2';
import { applyPaidReference } from '../_shared/payment-order-scope.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Verificar JWT (verify_jwt=true) e webhook secret
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const secret = Deno.env.get('WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret') || req.headers.get('asaas-access-token') || '';
  if (!secret || provided !== secret) {
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
      // Resolve the payment using each shop's provider account, never trust the
      // callback reference to choose a shop or an order.
      if (typeof payment.id !== 'string' || !/^pay_[a-zA-Z0-9_-]+$/.test(payment.id)) {
        return json({ error: 'Pagamento inválido' }, 400);
      }
      const { data: configs, error: configError } = await admin.from('empresa_config')
        .select('organization_id,gateway_clientes,gateway_clientes_credentials')
        .eq('gateway_clientes', 'asaas');
      if (configError) throw configError;
      for (const cfg of configs ?? []) {
        const credentials = cfg.gateway_clientes_credentials as any;
        if (!credentials?.api_key || !cfg.organization_id) continue;
        const base = credentials.asaas_environment === 'sandbox'
          ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
        const response = await fetch(`${base}/payments/${encodeURIComponent(payment.id)}`, {
          headers: { 'access_token': credentials.api_key },
        });
        if (!response.ok) continue;
        const verified = await response.json();
        if (verified.id !== payment.id || !['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(verified.status)) continue;
        await applyPaidReference(admin, cfg.organization_id, verified.externalReference);
        break;
      }
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
