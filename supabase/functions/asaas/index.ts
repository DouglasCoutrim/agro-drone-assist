import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = claimsData.claims.sub as string;

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: roleData } = await serviceClient
    .from('user_roles').select('role').eq('user_id', userId).maybeSingle();

  const { data: platformAdmin } = await serviceClient
    .from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();

  const userRole = roleData?.role;
  const isPlatformAdmin = !!platformAdmin;
  if (!isPlatformAdmin && (!userRole || !['admin', 'tecnico'].includes(userRole))) {
    return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve a chave da ORGANIZAÇÃO (nunca a chave global da plataforma).
  const { data: profile } = await serviceClient
    .from('profiles').select('organization_id').eq('id', userId).maybeSingle();
  const orgId = profile?.organization_id || null;

  let asaasKey = '';
  let asaasEnv = '';
  if (orgId) {
    const { data: cfg } = await serviceClient
      .from('empresa_config')
      .select('gateway_clientes, gateway_clientes_credentials')
      .eq('organization_id', orgId)
      .maybeSingle();
    const creds: any = cfg?.gateway_clientes_credentials || {};
    if (cfg?.gateway_clientes === 'asaas' && creds?.api_key) {
      asaasKey = creds.api_key;
      asaasEnv = creds.asaas_environment === 'sandbox' ? 'sandbox' : 'producao';
    }
  }

  // Fallback apenas para platform admins (operação global da plataforma).
  if (!asaasKey && isPlatformAdmin) {
    const globalKey = Deno.env.get('ASAAS_API_KEY');
    if (globalKey) {
      asaasKey = globalKey;
      asaasEnv = globalKey.startsWith('$aact_') ? 'producao' : 'sandbox';
    }
  }

  if (!asaasKey) {
    return new Response(JSON.stringify({ error: 'Gateway Asaas não configurado para esta organização' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = asaasEnv === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': asaasKey,
  };

  // Garante que operações de escrita estejam escopadas à organização do chamador.
  const requireOrg = () => {
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Sem organização associada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return null;
  };

  const url = new URL(req.url);

  // Parse body once if present (invoke always sends JSON POST)
  let body: any = {};
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    try { body = await req.json(); } catch { body = {}; }
  }

  // Accept action/params from body OR query string (backward compat)
  const action = body.action || url.searchParams.get('action');
  const getParam = (k: string) => body[k] ?? url.searchParams.get(k);

  try {
    if (action === 'create_customer') {
      const orgGuard = requireOrg();
      if (orgGuard) return orgGuard;
      const cleanCpfCnpj = body.cpfCnpj ? body.cpfCnpj.replace(/[.\-\/\s]/g, '') : undefined;
      const customerData = {
        name: body.name,
        email: body.email || undefined,
        mobilePhone: body.phone || undefined,
        cpfCnpj: cleanCpfCnpj,
        postalCode: body.postalCode || undefined,
        address: body.address || undefined,
        addressNumber: body.addressNumber || undefined,
        province: body.province || undefined,
        externalReference: body.externalReference || undefined,
      };

      const res = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(customerData),
      });
      const data = await res.json();

      if (!res.ok && data.errors) {
        const cpfError = data.errors.find((e: any) =>
          e.description?.toLowerCase().includes('cpfcnpj') ||
          e.description?.toLowerCase().includes('já existe') ||
          e.description?.toLowerCase().includes('already') ||
          e.code === 'invalid_cpfCnpj_duplicate'
        );

        if (cpfError && cleanCpfCnpj) {
          const searchRes = await fetch(
            `${baseUrl}/customers?cpfCnpj=${cleanCpfCnpj}`,
            { headers: asaasHeaders }
          );
          const searchData = await searchRes.json();

          if (searchData.data && searchData.data.length > 0) {
            return new Response(JSON.stringify(searchData.data[0]), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            });
          }
        }
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: res.status,
      });
    }

    if (action === 'list_customers') {
      const search = getParam('search') || '';
      const res = await fetch(`${baseUrl}/customers?name=${encodeURIComponent(search)}&limit=50`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'create_payment') {
      const orgGuard = requireOrg();
      if (orgGuard) return orgGuard;
      const res = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: body.customer,
          billingType: body.billingType,
          value: body.value,
          dueDate: body.dueDate,
          description: body.description || undefined,
          externalReference: body.externalReference || undefined,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });
    }

    if (action === 'list_payments') {
      const status = getParam('status') || '';
      const offset = getParam('offset') || '0';
      const limit = getParam('limit') || '50';
      let fetchUrl = `${baseUrl}/payments?offset=${offset}&limit=${limit}`;
      if (status) fetchUrl += `&status=${status}`;
      const res = await fetch(fetchUrl, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_payment') {
      const paymentId = getParam('id');
      if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${baseUrl}/payments/${paymentId}`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'pix_qrcode') {
      const paymentId = getParam('id');
      if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete_payment') {
      const paymentId = getParam('id');
      if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${baseUrl}/payments/${paymentId}`, { method: 'DELETE', headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });
    }

    if (action === 'payment_link') {
      const paymentId = getParam('id');
      if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${baseUrl}/payments/${paymentId}/identificationField`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Asaas edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
