// Webhook do Mercado Pago para cobranças emitidas pelas oficinas.
// Escuta payment.updated; quando status === 'approved' marca a fatura como paga.
// verify_jwt=true no config.toml - requer autenticação JWT.
// Valida assinatura HMAC do Mercado Pago quando MP_WEBHOOK_SECRET está configurado.
// Documentação: https://developer.mercadopago.com.br/docs/arr/payments/webhooks

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Verificar JWT
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Valida assinatura HMAC do Mercado Pago quando MP_WEBHOOK_SECRET está configurado
  const mpSecret = Deno.env.get('MP_WEBHOOK_SECRET');
  const sharedSecret = Deno.env.get('WEBHOOK_SECRET');

  if (mpSecret) {
    const signature = req.headers.get('x-signature') || '';
    const requestId = req.headers.get('x-request-id') || '';
    const raw = await req.text();
    const typeMatch = raw.match(/"type"\s*:\s*"([^"]+)"/);
    const idMatch = raw.match(/"id"\s*:\s*(\d+)/);
    if (!signature || !requestId || !typeMatch || !idMatch) return json({ error: 'Assinatura ausente' }, 401);

    const ts = new URLSearchParams(signature).get('ts');
    const v1 = new URLSearchParams(signature).get('v1');
    const manifest = `id:${idMatch[1]};request-id:${requestId};ts:${ts};`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(mpSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (expected !== v1) return json({ error: 'Assinatura inválida' }, 401);

    let body: any = {};
    try { body = JSON.parse(raw); } catch { /* ignore */ }
    const url = new URL(req.url);
    const type = body?.type || url.searchParams.get('type');
    const paymentId = body?.data?.id || url.searchParams.get('data.id');
    await handlePayment(paymentId, type);
    return json({ received: true });
  }

  if (sharedSecret && (req.headers.get('x-webhook-secret') || '') !== sharedSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const type = body?.type || url.searchParams.get('type');
    const paymentId = body?.data?.id || url.searchParams.get('data.id');
    await handlePayment(paymentId, type);
    return json({ received: true });
  } catch (e: any) {
    console.error('mercadopago-webhook error', e);
    return json({ error: e?.message ?? 'erro' }, 500);
  }
});

async function handlePayment(paymentId: string | null, type: string | null) {
  if (type !== 'payment' || !paymentId) return;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: cfgs } = await admin
    .from('empresa_config')
    .select('organization_id, gateway_clientes, gateway_clientes_credentials');

  let approved = false;
  let externalRef: string | undefined;

  for (const cfg of cfgs ?? []) {
    if (cfg.gateway_clientes !== 'mercadopago') continue;
    const token = (cfg.gateway_clientes_credentials as any)?.token;
    if (!token) continue;
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) continue;
    const pay = await r.json();
    if (pay?.status === 'approved') {
      approved = true;
      externalRef = pay.external_reference;
      break;
    }
  }

  if (approved && externalRef) {
    const { data: os } = await admin.from('ordens_servico').select('id').eq('id', externalRef).maybeSingle();
    if (os) {
      await admin.from('ordens_servico').update({ status: 'finalizada' }).eq('id', externalRef);
    } else {
      await admin.from('orcamentos').update({ status: 'aprovado' }).eq('id', externalRef);
    }
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
