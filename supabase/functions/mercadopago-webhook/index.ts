// Webhook do Mercado Pago para cobranças emitidas pelas oficinas.
// Escuta payment.updated; quando status === 'approved' marca a fatura como paga.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const type = body?.type || url.searchParams.get('type');
    const paymentId = body?.data?.id || url.searchParams.get('data.id');

    if (type !== 'payment' || !paymentId) return json({ ok: true });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Buscamos as credenciais por external_reference: como o MP webhook não vem
    // com o token do tenant, dependemos do external_reference para localizar a OS
    // e via OS, a organização e suas credenciais.
    // Para descobrir o status, precisamos do access token. Como o webhook é
    // global, varremos as orgs que têm MP configurado e tentamos consultar.
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
      await admin.from('ordens_servico').update({ status: 'finalizada' }).eq('id', externalRef);
      await admin.from('orcamentos').update({ status: 'aprovado' }).eq('id', externalRef);
    }

    return json({ received: true, approved });
  } catch (e: any) {
    console.error('mercadopago-webhook error', e);
    return json({ error: e?.message ?? 'erro' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
