import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    .from('user_roles').select('role').eq('user_id', userId).single();

  const userRole = roleData?.role;
  if (!userRole || !['admin', 'tecnico'].includes(userRole)) {
    return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ASAAS_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = ASAAS_API_KEY.startsWith('$aact_') 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  try {
    if (action === 'create_customer' && req.method === 'POST') {
      const body = await req.json();
      
      // Clean CPF/CNPJ - remove dots, dashes, slashes
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

      // If CPF/CNPJ already exists, search for existing customer and return it
      if (!res.ok && data.errors) {
        const cpfError = data.errors.find((e: any) => 
          e.description?.toLowerCase().includes('cpfcnpj') || 
          e.description?.toLowerCase().includes('já existe') ||
          e.description?.toLowerCase().includes('already') ||
          e.code === 'invalid_cpfCnpj_duplicate'
        );
        
        if (cpfError && cleanCpfCnpj) {
          // Search existing customer by CPF/CNPJ
          const searchRes = await fetch(
            `${baseUrl}/customers?cpfCnpj=${cleanCpfCnpj}`,
            { headers: asaasHeaders }
          );
          const searchData = await searchRes.json();
          
          if (searchData.data && searchData.data.length > 0) {
            const existingCustomer = searchData.data[0];
            return new Response(JSON.stringify(existingCustomer), {
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

    if (action === 'list_customers' && req.method === 'GET') {
      const search = url.searchParams.get('search') || '';
      const res = await fetch(`${baseUrl}/customers?name=${encodeURIComponent(search)}&limit=50`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'create_payment' && req.method === 'POST') {
      const body = await req.json();
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

    if (action === 'list_payments' && req.method === 'GET') {
      const status = url.searchParams.get('status') || '';
      const offset = url.searchParams.get('offset') || '0';
      const limit = url.searchParams.get('limit') || '50';
      let fetchUrl = `${baseUrl}/payments?offset=${offset}&limit=${limit}`;
      if (status) fetchUrl += `&status=${status}`;
      const res = await fetch(fetchUrl, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_payment' && req.method === 'GET') {
      const paymentId = url.searchParams.get('id');
      if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${baseUrl}/payments/${paymentId}`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'pix_qrcode' && req.method === 'GET') {
      const paymentId = url.searchParams.get('id');
      if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete_payment' && req.method === 'DELETE') {
      const paymentId = url.searchParams.get('id');
      if (!paymentId) return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${baseUrl}/payments/${paymentId}`, { method: 'DELETE', headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });
    }

    if (action === 'payment_link' && req.method === 'GET') {
      const paymentId = url.searchParams.get('id');
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
