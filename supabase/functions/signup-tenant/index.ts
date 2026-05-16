import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password, nome, empresa, telefone, cnpj, plan_slug } = await req.json();

    if (!email || !password || !nome || !empresa) {
      return new Response(JSON.stringify({ ok: false, error: 'Dados obrigatórios ausentes.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create user (auto-confirmed)
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (userErr || !created.user) throw userErr || new Error('Falha ao criar usuário');
    const userId = created.user.id;

    // 2. Get plan
    const slug = plan_slug || 'trial';
    const { data: planRow } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('slug', slug === 'trial' ? 'basic' : slug)
      .maybeSingle();

    const monthlyFee = slug === 'trial' ? 0 : (planRow?.monthly_price ?? 0);
    const maxUsers = planRow?.max_users ?? 3;
    const maxOs = planRow?.max_os_per_month ?? 100;

    // 3. Create organization
    const orgSlug = empresa.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        owner_id: userId,
        name: empresa,
        slug: orgSlug,
        telefone: telefone || null,
        plan: slug,
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        monthly_fee: monthlyFee,
        max_users: maxUsers,
        max_os_per_month: maxOs,
      })
      .select()
      .single();
    if (orgErr) throw orgErr;

    // 4. Profile (handle_new_user trigger created it; just patch org_id)
    await admin.from('profiles').upsert({
      id: userId,
      email,
      nome,
      telefone: telefone || null,
      organization_id: org.id,
    });

    // 5. Role admin (replace default 'consulta')
    await admin.from('user_roles').delete().eq('user_id', userId);
    await admin.from('user_roles').insert({ user_id: userId, role: 'admin' });

    // 6. empresa_config
    await admin.from('empresa_config').insert({
      owner_id: userId,
      organization_id: org.id,
      nome_empresa: empresa,
      cnpj: cnpj || '',
      telefone: telefone || '',
      responsavel: nome,
    });

    return new Response(JSON.stringify({ ok: true, organization_id: org.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('signup-tenant error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Erro inesperado' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
