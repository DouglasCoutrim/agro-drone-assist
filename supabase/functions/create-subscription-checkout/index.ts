import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_BASE = 'https://api.asaas.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const { plan_slug, cycle } = await req.json();
    if (!['bronze', 'prata', 'ouro'].includes(plan_slug)) return json({ error: 'Plano inválido' }, 400);
    if (!['mensal', 'semestral', 'anual'].includes(cycle)) return json({ error: 'Ciclo inválido' }, 400);

    // Admin client para escrita e leitura sem RLS issues
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile } = await admin.from('profiles').select('organization_id, email, nome').eq('id', userId).maybeSingle();
    if (!profile?.organization_id) return json({ error: 'Sem organização' }, 400);

    const { data: plan } = await admin.from('subscription_plans').select('*').eq('slug', plan_slug).maybeSingle();
    if (!plan) return json({ error: 'Plano não encontrado' }, 404);

    const months = cycle === 'mensal' ? 1 : cycle === 'semestral' ? 6 : 12;
    const discount = cycle === 'mensal' ? 0 : cycle === 'semestral' ? 0.10 : 0.20;
    const valor = Number((plan.monthly_price * months * (1 - discount)).toFixed(2));

    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 3);
    const vencISO = vencimento.toISOString().slice(0, 10);
    const competencia = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // 1) Criar invoice local
    const { data: invoice, error: invErr } = await admin
      .from('tenant_invoices')
      .insert({
        organization_id: profile.organization_id,
        valor,
        vencimento: vencISO,
        competencia,
        status: 'pendente',
      })
      .select()
      .single();
    if (invErr) throw invErr;

    // 2) Asaas
    const ASAAS_KEY = Deno.env.get('PLATFORM_ASAAS_API_KEY') || Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_KEY) return json({ error: 'Asaas não configurado' }, 500);

    // Buscar ou criar customer
    let customerId: string | null = null;
    const custSearch = await fetch(`${ASAAS_BASE}/customers?email=${encodeURIComponent(profile.email)}`, {
      headers: { 'access_token': ASAAS_KEY },
    }).then(r => r.json());
    if (custSearch?.data?.[0]?.id) {
      customerId = custSearch.data[0].id;
    } else {
      const newCust = await fetch(`${ASAAS_BASE}/customers`, {
        method: 'POST',
        headers: { 'access_token': ASAAS_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.nome || profile.email, email: profile.email }),
      }).then(r => r.json());
      customerId = newCust.id;
    }

    // Criar charge
    const charge = await fetch(`${ASAAS_BASE}/payments`, {
      method: 'POST',
      headers: { 'access_token': ASAAS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED',
        value: valor,
        dueDate: vencISO,
        description: `Assinatura ${plan.name} - ${cycle}`,
        externalReference: invoice.id,
      }),
    }).then(r => r.json());

    if (charge.errors) return json({ error: charge.errors[0]?.description || 'Erro Asaas' }, 400);

    // Buscar PIX QR
    let pixQr: any = {};
    try {
      pixQr = await fetch(`${ASAAS_BASE}/payments/${charge.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_KEY },
      }).then(r => r.json());
    } catch (_) {}

    await admin.from('tenant_invoices').update({
      asaas_charge_id: charge.id,
      payment_url: charge.invoiceUrl,
    }).eq('id', invoice.id);

    // Atualizar ciclo escolhido na org
    await admin.from('organizations').update({
      billing_cycle: cycle,
      cycle_discount: discount,
    }).eq('id', profile.organization_id);

    return json({
      invoice_id: invoice.id,
      charge_id: charge.id,
      invoice_url: charge.invoiceUrl,
      bank_slip_url: charge.bankSlipUrl,
      barcode: charge.identificationField,
      pix_payload: pixQr.payload,
      pix_qr_image: pixQr.encodedImage,
    });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message || 'Erro interno' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
