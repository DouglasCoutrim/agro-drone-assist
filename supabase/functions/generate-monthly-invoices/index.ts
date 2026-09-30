import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_KEY = Deno.env.get('PLATFORM_ASAAS_API_KEY') || Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_BASE = 'https://api.asaas.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify caller is platform admin
    const authHeader = req.headers.get('Authorization');
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { headers: corsHeaders, status: 401 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: pa } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!pa) return new Response(JSON.stringify({ ok: false, error: 'Apenas Super Admin' }), { headers: corsHeaders, status: 403 });

    const today = new Date();
    const competencia = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const vencimento = new Date(today.getFullYear(), today.getMonth(), 10);
    if (vencimento < today) vencimento.setMonth(vencimento.getMonth() + 1);
    const vencimentoStr = vencimento.toISOString().slice(0, 10);

    // Fetch active orgs with monthly_fee > 0
    const { data: orgs } = await admin
      .from('organizations')
      .select('id, name, monthly_fee, owner_id')
      .gt('monthly_fee', 0)
      .not('status', 'in', '("blocked","canceled")');

    let created = 0, skipped = 0;
    const results: any[] = [];

    for (const org of orgs || []) {
      // skip if invoice already exists for this competencia
      const { data: existing } = await admin
        .from('tenant_invoices')
        .select('id')
        .eq('organization_id', org.id)
        .eq('competencia', competencia)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      // get owner profile for email/cpfcnpj
      const { data: profile } = await admin
        .from('profiles').select('email, nome').eq('id', org.owner_id).maybeSingle();

      let asaasChargeId: string | null = null;
      let paymentUrl: string | null = null;

      if (ASAAS_KEY && profile?.email) {
        try {
          // 1. Find or create customer in Asaas
          const findRes = await fetch(`${ASAAS_BASE}/customers?email=${encodeURIComponent(profile.email)}`, {
            headers: { access_token: ASAAS_KEY },
          });
          const findJson = await findRes.json();
          let customerId = findJson?.data?.[0]?.id;

          if (!customerId) {
            const createRes = await fetch(`${ASAAS_BASE}/customers`, {
              method: 'POST',
              headers: { access_token: ASAAS_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: org.name, email: profile.email }),
            });
            const created = await createRes.json();
            customerId = created?.id;
          }

          if (customerId) {
            const payRes = await fetch(`${ASAAS_BASE}/payments`, {
              method: 'POST',
              headers: { access_token: ASAAS_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customer: customerId, billingType: 'UNDEFINED',
                value: Number(org.monthly_fee), dueDate: vencimentoStr,
                description: `Mensalidade ${competencia} - ${org.name}`,
                externalReference: `tenant:${org.id}:${competencia}`,
              }),
            });
            const pay = await payRes.json();
            asaasChargeId = pay?.id || null;
            paymentUrl = pay?.invoiceUrl || pay?.bankSlipUrl || null;
          }
        } catch (e) {
          console.error('Asaas error for org', org.id, e);
        }
      }

      const { error: insErr } = await admin.from('tenant_invoices').insert({
        organization_id: org.id, competencia, valor: org.monthly_fee,
        vencimento: vencimentoStr, status: 'pendente',
        asaas_charge_id: asaasChargeId, payment_url: paymentUrl,
      });
      if (!insErr) { created++; results.push({ org: org.name, paymentUrl }); }
    }

    return new Response(JSON.stringify({ ok: true, created, skipped, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
