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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ASAAS_API_KEY não configurada' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = ASAAS_API_KEY.startsWith('$aact_')
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  try {
    const body = await req.json();
    const { nome, email, telefone, cpf_cnpj, cep, endereco, cidade, clienteId } = body;

    const cleanCpfCnpj = cpf_cnpj ? cpf_cnpj.replace(/[.\-\/\s]/g, '') : undefined;

    const customerData: Record<string, string | undefined> = {
      name: nome,
      email: email || undefined,
      mobilePhone: telefone || undefined,
      cpfCnpj: cleanCpfCnpj,
      postalCode: cep?.replace(/\D/g, '') || undefined,
      address: endereco || undefined,
      province: cidade || undefined,
      externalReference: clienteId || undefined,
    };

    // Remove undefined values
    Object.keys(customerData).forEach(k => {
      if (customerData[k] === undefined) delete customerData[k];
    });

    const res = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(customerData),
    });

    const data = await res.json();

    // Success
    if (res.ok && data.id) {
      return new Response(JSON.stringify({ asaas_id: data.id, success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle duplicate CPF/CNPJ - search existing customer
    if (!res.ok && data.errors && cleanCpfCnpj) {
      const isDuplicate = data.errors.some((e: any) =>
        e.description?.toLowerCase().includes('cpfcnpj') ||
        e.description?.toLowerCase().includes('já existe') ||
        e.description?.toLowerCase().includes('already') ||
        e.code === 'invalid_cpfCnpj_duplicate'
      );

      if (isDuplicate) {
        const searchRes = await fetch(
          `${baseUrl}/customers?cpfCnpj=${cleanCpfCnpj}`,
          { headers: asaasHeaders }
        );
        const searchData = await searchRes.json();

        if (searchData.data?.length > 0) {
          return new Response(JSON.stringify({
            asaas_id: searchData.data[0].id,
            success: true,
            reused: true,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Other errors
    const errorMsg = data.errors?.[0]?.description || 'Erro ao criar cliente no Asaas';
    return new Response(JSON.stringify({ error: errorMsg, details: data.errors }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('asaas-customer-sync error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao sincronizar com Asaas' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
