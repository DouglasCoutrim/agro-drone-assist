import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ASAAS_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Determine environment from key prefix
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
    // CREATE CUSTOMER
    if (action === 'create_customer' && req.method === 'POST') {
      const body = await req.json();
      const res = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          name: body.name,
          email: body.email || undefined,
          phone: body.phone || undefined,
          cpfCnpj: body.cpfCnpj,
          postalCode: body.postalCode || undefined,
          address: body.address || undefined,
          addressNumber: body.addressNumber || undefined,
          province: body.province || undefined,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });
    }

    // LIST CUSTOMERS
    if (action === 'list_customers' && req.method === 'GET') {
      const search = url.searchParams.get('search') || '';
      const res = await fetch(`${baseUrl}/customers?name=${encodeURIComponent(search)}&limit=50`, {
        headers: asaasHeaders,
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // CREATE PAYMENT (charge)
    if (action === 'create_payment' && req.method === 'POST') {
      const body = await req.json();
      const res = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify({
          customer: body.customer,
          billingType: body.billingType, // BOLETO, CREDIT_CARD, PIX
          value: body.value,
          dueDate: body.dueDate,
          description: body.description || undefined,
          externalReference: body.externalReference || undefined,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });
    }

    // LIST PAYMENTS
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

    // GET PAYMENT BY ID
    if (action === 'get_payment' && req.method === 'GET') {
      const paymentId = url.searchParams.get('id');
      if (!paymentId) {
        return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${baseUrl}/payments/${paymentId}`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET PIX QR CODE
    if (action === 'pix_qrcode' && req.method === 'GET') {
      const paymentId = url.searchParams.get('id');
      if (!paymentId) {
        return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE / CANCEL PAYMENT
    if (action === 'delete_payment' && req.method === 'DELETE') {
      const paymentId = url.searchParams.get('id');
      if (!paymentId) {
        return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${baseUrl}/payments/${paymentId}`, { method: 'DELETE', headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });
    }

    // GET PAYMENT LINK (invoice URL)
    if (action === 'payment_link' && req.method === 'GET') {
      const paymentId = url.searchParams.get('id');
      if (!paymentId) {
        return new Response(JSON.stringify({ error: 'Payment ID required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const res = await fetch(`${baseUrl}/payments/${paymentId}/identificationField`, { headers: asaasHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Supported: create_customer, list_customers, create_payment, list_payments, get_payment, pix_qrcode, delete_payment, payment_link' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
