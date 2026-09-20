import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeadersRestricted = {
  'Access-Control-Allow-Origin': 'https://iynljexyjhbkfxsurddn.supabase.co',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeadersRestricted });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
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
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  }

  const userId = claimsData.claims.sub as string;
  const userRole = claimsData.claims.role as string || 'consulta';

  // A3: Role check - apenas admin/técnico podem sincronizar clientes
  if (!['admin', 'tecnico'].includes(userRole)) {
    return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
      status: 403, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  }

  // Resolve a chave da ORGANIZAÇÃO (nunca a chave global da plataforma).
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await serviceClient
    .from('profiles').select('organization_id').eq('id', userId).maybeSingle();
  const orgId = profile?.organization_id || null;
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'Sem organização associada' }), {
      status: 400, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  }

  // Usar empresa_gateway_credenciais em vez de empresa_config
  const { data: cfg } = await serviceClient
    .from('empresa_gateway_credenciais')
    .select('chave_json')
    .eq('organization_id', orgId)
    .eq('gateway_tipo', 'asaas')
    .maybeSingle();
  const credsJson = cfg?.chave_json || {};
  const asaasKey = credsJson?.api_key || null;

  if (!asaasKey) {
    return new Response(JSON.stringify({ error: 'Gateway Asaas não configurado para esta organização' }), {
      status: 400, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = credsJson?.asaas_environment === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': asaasKey,
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

    Object.keys(customerData).forEach(k => {
      if (customerData[k] === undefined) delete customerData[k];
    });

    const res = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(customerData),
    });

    const data = await res.json();

    if (res.ok && data.id) {
      return new Response(JSON.stringify({ asaas_id: data.id, success: true }), {
        headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
      });
    }

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
            headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const errorMsg = data.errors?.[0]?.description || 'Erro ao criar cliente no Asaas';
    return new Response(JSON.stringify({ error: errorMsg, details: data.errors }), {
      status: 400, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('asaas-customer-sync error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao sincronizar com Asaas' }), {
      status: 500, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  }
});
