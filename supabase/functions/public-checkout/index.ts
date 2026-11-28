import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ALLOWED_ORIGIN } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const VALID_CYCLES = ['mensal', 'semestral', 'anual'] as const;
type Cycle = typeof VALID_CYCLES[number];

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

function configObject(value: unknown): { asaas_api_key?: string; asaas_environment?: 'sandbox' | 'production' } {
  if (typeof value === 'string') {
    try { return configObject(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === 'object' ? value as { asaas_api_key?: string; asaas_environment?: 'sandbox' | 'production' } : {};
}

function cycleInfo(cycle: Cycle) {
  return cycle === 'mensal'
    ? { months: 1, discount: 0 }
    : cycle === 'semestral'
      ? { months: 6, discount: 0.10 }
      : { months: 12, discount: 0.20 };
}

function publicPayment(invoice: Record<string, unknown>, pixQr: Record<string, unknown> = {}) {
  return {
    invoice_id: invoice.id,
    status: invoice.status,
    charge_id: invoice.asaas_charge_id,
    invoice_url: invoice.payment_url,
    bank_slip_url: invoice.bank_slip_url ?? null,
    barcode: invoice.barcode ?? null,
    pix_payload: pixQr.payload ?? null,
    pix_qr_image: pixQr.encodedImage ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  try {
    const { token, action = 'details', cycle } = await req.json();
    if (typeof token !== 'string' || token.length < 32 || token.length > 128) return json({ error: 'Link de checkout inválido' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const tokenHash = await hashToken(token);
    const { data: session, error: sessionError } = await admin
      .from('checkout_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (sessionError || !session) return json({ error: 'Checkout não encontrado ou expirado' }, 404);

    if (new Date(session.expires_at).getTime() < Date.now() && session.status !== 'paid') {
      await admin.from('checkout_sessions').update({ status: 'expired' }).eq('id', session.id);
      return json({ error: 'Este link de checkout expirou. Inicie um novo cadastro.' }, 410);
    }

    const [{ data: plan }, { data: organization }] = await Promise.all([
      admin.from('subscription_plans').select('name,slug,monthly_price,max_users,features').eq('slug', session.plan_slug).maybeSingle(),
      admin.from('organizations').select('name,owner_id,plan,status,subscription_status').eq('id', session.organization_id).maybeSingle(),
    ]);
    if (!plan || !organization) return json({ error: 'Dados do plano não encontrados' }, 404);

    if (action === 'details') {
      const info = cycleInfo(session.billing_cycle as Cycle);
      return json({
        ok: true,
        status: session.status,
        organization_name: organization.name,
        organization_status: organization.status,
        plan: { name: plan.name, slug: plan.slug, monthly_price: plan.monthly_price, max_users: plan.max_users, features: plan.features },
        cycle: session.billing_cycle,
        months: info.months,
        discount: info.discount,
        invoice_id: session.invoice_id,
      });
    }

    if (action !== 'create_payment') return json({ error: 'Ação inválida' }, 400);
    if (session.status === 'paid') {
      const { data: paidInvoice } = await admin.from('tenant_invoices').select('*').eq('id', session.invoice_id).maybeSingle();
      return json({ ok: true, already_paid: true, payment: paidInvoice ? publicPayment(paidInvoice) : null });
    }
    if (cycle && !VALID_CYCLES.includes(cycle as Cycle)) return json({ error: 'Ciclo inválido' }, 400);

    const selectedCycle = (cycle || session.billing_cycle || 'mensal') as Cycle;
    const info = cycleInfo(selectedCycle);
    const value = Number((Number(plan.monthly_price) * info.months * (1 - info.discount)).toFixed(2));

    let { data: invoice } = session.invoice_id
      ? await admin.from('tenant_invoices').select('*').eq('id', session.invoice_id).maybeSingle()
      : await admin.from('tenant_invoices').select('*').eq('checkout_session_id', session.id).maybeSingle();
    if (invoice?.asaas_charge_id && invoice.status !== 'falhou') {
      return json({ ok: true, payment: publicPayment(invoice) });
    }

    const { data: platformConfig } = await admin.from('platform_config').select('value').eq('key', 'asaas').maybeSingle();
    const configured = configObject(platformConfig?.value);
    const environment = configured.asaas_environment === 'sandbox' ? 'sandbox' : 'production';
    const asaasBase = environment === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
    const asaasKey = configured.asaas_api_key?.trim() || Deno.env.get('PLATFORM_ASAAS_API_KEY') || Deno.env.get('ASAAS_API_KEY');
    if (!asaasKey) return json({ error: 'Pagamento temporariamente indisponível. Tente novamente mais tarde.' }, 503);

    const { data: profile } = await admin.from('profiles').select('email,nome,organization_id').eq('organization_id', session.organization_id).eq('id', organization.owner_id ?? '').maybeSingle();
    const ownerProfile = profile || (await admin.from('profiles').select('email,nome').eq('organization_id', session.organization_id).limit(1).maybeSingle()).data;
    if (!ownerProfile?.email) return json({ error: 'Dados de contato do cadastro não encontrados' }, 422);

    let customerId = session.asaas_customer_id as string | null;
    if (!customerId) {
      const customerSearch = await fetch(`${asaasBase}/customers?email=${encodeURIComponent(ownerProfile.email)}`, { headers: { 'access_token': asaasKey } }).then((response) => response.json());
      customerId = customerSearch?.data?.[0]?.id || null;
      if (!customerId) {
        const customerResponse = await fetch(`${asaasBase}/customers`, {
          method: 'POST', headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: ownerProfile.nome || organization.name, email: ownerProfile.email }),
        });
        const customer = await customerResponse.json();
        if (!customer?.id) throw new Error(customer?.errors?.[0]?.description || 'Não foi possível criar o cliente de cobrança');
        customerId = customer.id;
      }
      await admin.from('checkout_sessions').update({ asaas_customer_id: customerId }).eq('id', session.id);
    }

    const due = new Date();
    due.setDate(due.getDate() + 3);
    const dueDate = due.toISOString().slice(0, 10);
    if (!invoice) {
      const created = await admin.from('tenant_invoices').insert({
        organization_id: session.organization_id,
        checkout_session_id: session.id,
        valor: value,
        vencimento: dueDate,
        competencia: dueDate.slice(0, 7),
        status: 'criando',
        billing_cycle: selectedCycle,
        asaas_environment: environment,
      }).select('*').single();
      if (created.error) throw created.error;
      invoice = created.data;
    } else {
      await admin.from('tenant_invoices').update({ valor: value, billing_cycle: selectedCycle, asaas_environment: environment, status: 'criando', failure_reason: null }).eq('id', invoice.id);
    }

    const chargeResponse = await fetch(`${asaasBase}/payments`, {
      method: 'POST',
      headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED',
        value,
        dueDate,
        description: `Assinatura ${plan.name} - ${selectedCycle}`,
        externalReference: invoice.id,
      }),
    });
    const charge = await chargeResponse.json();
    if (!chargeResponse.ok || charge.errors || !charge.id) {
      const message = charge?.errors?.[0]?.description || 'Não foi possível gerar a cobrança';
      await admin.from('tenant_invoices').update({ status: 'falhou', failure_reason: message }).eq('id', invoice.id);
      await admin.from('checkout_sessions').update({ status: 'failed', last_error: message }).eq('id', session.id);
      return json({ error: message }, 400);
    }

    let pixQr: Record<string, unknown> = {};
    try {
      pixQr = await fetch(`${asaasBase}/payments/${charge.id}/pixQrCode`, { headers: { 'access_token': asaasKey } }).then((response) => response.json());
    } catch { /* Pix pode não estar disponível para todos os clientes. */ }

    const invoiceUpdate = {
      status: 'pendente', asaas_charge_id: charge.id, payment_url: charge.invoiceUrl,
      bank_slip_url: charge.bankSlipUrl || null, barcode: charge.identificationField || null,
      payment_method: charge.billingType || 'UNDEFINED', last_webhook_event: null,
    };
    await admin.from('tenant_invoices').update(invoiceUpdate).eq('id', invoice.id);
    await admin.from('organizations').update({ billing_cycle: selectedCycle, cycle_discount: info.discount }).eq('id', session.organization_id);
    await admin.from('checkout_sessions').update({ status: 'awaiting_payment', billing_cycle: selectedCycle, invoice_id: invoice.id, asaas_charge_id: charge.id }).eq('id', session.id);

    return json({ ok: true, payment: publicPayment({ ...invoice, ...invoiceUpdate, bank_slip_url: charge.bankSlipUrl, barcode: charge.identificationField }, pixQr) });
  } catch (error) {
    console.error('public-checkout error', error);
    return json({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});
