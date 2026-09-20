import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Protegido: verify_jwt=true no config.toml
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Verificar autenticação JWT (Prompt 1.7)
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const token = authHeader.replace('Bearer ', '');
  const { data: claims } = await supabase.auth.getClaims(token);
  if (!claims?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // Verificar se é platform admin ou admin da org
  const userId = claims.claims.sub as string;
  const { data: pa } = await supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle();
  const isPlatformAdmin = !!pa;

  if (!isPlatformAdmin) {
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    const isAdminOrTecnico = roleData?.role && ['admin', 'tecnico'].includes(roleData.role);
    if (!isAdminOrTecnico) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }
  }

  try {
    const { gateway, credential } = await req.json();
    if (!credential) return json({ ok: false, message: 'Credencial vazia' }, 400);

    let isValid = false;
    let message = '';

    if (gateway === 'asaas') {
      const r = await fetch('https://api.asaas.com/v3/myAccount', {
        headers: { 'access_token': credential },
      });
      isValid = r.ok;
      message = isValid ? '' : 'API Key inválida ou bloqueada';
    }

    if (gateway === 'mercadopago') {
      const r = await fetch('https://api.mercadopago.com/users/me', {
        headers: { 'Authorization': `Bearer ${credential}` },
      });
      isValid = r.ok;
      message = isValid ? '' : 'Access Token inválido';
    }

    return json({ ok: isValid, message });
  } catch (e: any) {
    return json({ ok: false, message: e?.message ?? 'Erro' }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
