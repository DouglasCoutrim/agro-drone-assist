import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

    const { cliente_id, valor, descricao, ordem_servico_id, orcamento_id } = await req.json();
    if (!valor || valor <= 0) return json({ error: 'Valor inválido' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: profile } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    if (!profile?.organization_id) return json({ error: 'Sem organização' }, 400);

    const { data: cfg } = await admin
      .from('empresa_config')
      .select('gateway_clientes, gateway_clientes_credentials')
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!cfg || cfg.gateway_clientes === 'none') return json({ error: 'Gateway não configurado' }, 400);

    let cliente: any = null;
    if (cliente_id) {
      const { data } = await admin.from('clientes').select('*').eq('id', cliente_id).maybeSingle();
      cliente = data;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueISO = dueDate.toISOString().slice(0, 10);

    if (cfg.gateway_clientes === 'asaas') {
      const apiKey = (cfg.gateway_clientes_credentials as any)?.api_key;
      if (!apiKey) return json({ error: 'API Key Asaas ausente' }, 400);

      // customer
      let custId: string | null = null;
      if (cliente?.email) {
        const found = await fetch(`https://api.asaas.com/v3/customers?email=${encodeURIComponent(cliente.email)}`, {
          headers: { 'access_token': apiKey },
        }).then(r => r.json());
        custId = found?.data?.[0]?.id || null;
      }
      if (!custId) {
        const cust = await fetch('https://api.asaas.com/v3/customers', {
          method: 'POST',
          headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cliente?.nome || 'Cliente',
            email: cliente?.email,
            mobilePhone: cliente?.telefone,
            cpfCnpj: cliente?.cpf_cnpj,
          }),
        }).then(r => r.json());
        custId = cust.id;
      }

      const charge = await fetch('https://api.asaas.com/v3/payments', {
        method: 'POST',
        headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: custId,
          billingType: 'UNDEFINED',
          value: valor,
          dueDate: dueISO,
          description: descricao || 'Pagamento',
          externalReference: ordem_servico_id || orcamento_id,
        }),
      }).then(r => r.json());

      if (charge.errors) return json({ error: charge.errors[0]?.description }, 400);

      let pix: any = {};
      try {
        pix = await fetch(`https://api.asaas.com/v3/payments/${charge.id}/pixQrCode`, {
          headers: { 'access_token': apiKey },
        }).then(r => r.json());
      } catch (_) {}

      return json({
        payment_url: charge.invoiceUrl,
        bank_slip_url: charge.bankSlipUrl,
        pix_payload: pix.payload,
        pix_qr_image: pix.encodedImage,
      });
    }

    if (cfg.gateway_clientes === 'mercadopago') {
      const accessToken = (cfg.gateway_clientes_credentials as any)?.token;
      if (!accessToken) return json({ error: 'Access Token MP ausente' }, 400);

      const pref = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ title: descricao || 'Pagamento', quantity: 1, unit_price: Number(valor), currency_id: 'BRL' }],
          payer: cliente?.email ? { email: cliente.email } : undefined,
          external_reference: ordem_servico_id || orcamento_id,
        }),
      }).then(r => r.json());

      if (pref.error) return json({ error: pref.message || 'Erro MP' }, 400);

      return json({
        payment_url: pref.init_point,
        sandbox_url: pref.sandbox_init_point,
      });
    }

    return json({ error: 'Gateway desconhecido' }, 400);
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
