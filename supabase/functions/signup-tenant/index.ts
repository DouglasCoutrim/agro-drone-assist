import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_PLAN_SLUGS = ['bronze', 'prata', 'ouro'];

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
    // O seed de subscription_plans tem apenas bronze/prata/ouro. O slug 'basic'
    // (default antigo do formulário) e 'trial' NÃO existem no catálogo e faziam o
    // lookup retornar vazio, deixando a org sem plano/limites consistentes.
    // Fallback: trial (incl. 'basic'/desconhecido) -> limites do bronze, sem mensalidade.
    const requestedSlug = (plan_slug || 'trial').toLowerCase();
    const isTrial = !VALID_PLAN_SLUGS.includes(requestedSlug);
    const lookupSlug = isTrial ? 'bronze' : requestedSlug;

    const { data: planRow, error: planErr } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('slug', lookupSlug)
      .maybeSingle();
    if (planErr) throw planErr;

    const plan = planRow ?? { id: null, monthly_price: 0, max_users: 3, max_os_per_month: 100 };
    const orgPlan = isTrial ? 'trial' : requestedSlug;
    const monthlyFee = isTrial ? 0 : (plan.monthly_price ?? 0);
    const maxUsers = plan.max_users ?? 3;
    const maxOs = plan.max_os_per_month ?? 100;

    // 3. Create organization
    const orgSlug = empresa.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        owner_id: userId,
        name: empresa,
        slug: orgSlug,
        telefone: telefone || null,
        plan: orgPlan,
        plan_id: isTrial ? null : plan.id ?? null,
        status: 'trial',
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        monthly_fee: monthlyFee,
        max_users: maxUsers,
        max_os_per_month: maxOs,
      })
      .select()
      .single();
    if (orgErr || !org) throw orgErr || new Error('Falha ao criar organização');

    // 4. Profile (handle_new_user trigger created it; just patch org_id)
    // Garante o vínculo com a organização — sem ele, o RLS bloqueia todas as
    // gravações do usuário (produtos, categorias, clientes, etc.).
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        email,
        nome,
        telefone: telefone || null,
        organization_id: org.id,
      },
      { onConflict: 'id' }
    );
    if (profileErr) throw profileErr;

    // Rechecagem defensiva: se por qualquer motivo o upsert não aplicar em linha
    // existente, force via UPDATE.
    const { data: savedProfile, error: savedProfileErr } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();
    if (savedProfileErr) throw savedProfileErr;
    if (!savedProfile?.organization_id) {
      const { error: fixErr } = await admin
        .from('profiles')
        .update({ organization_id: org.id })
        .eq('id', userId);
      if (fixErr) throw fixErr;
    }

    // 5. Role admin (replace default 'consulta')
    await admin.from('user_roles').delete().eq('user_id', userId);
    const { error: roleErr } = await admin.from('user_roles').insert({ user_id: userId, role: 'admin' });
    if (roleErr) throw roleErr;

    // 6. user_permissions (garante a linha, evita fail-open/legado do trigger)
    const { error: permErr } = await admin.from('user_permissions').upsert(
      {
        user_id: userId,
        acesso_os: true,
        acesso_estoque: true,
        acesso_financeiro: true,
      },
      { onConflict: 'user_id' }
    );
    if (permErr) throw permErr;

    // 7. empresa_config
    const { error: cfgErr } = await admin.from('empresa_config').insert({
      owner_id: userId,
      organization_id: org.id,
      nome_empresa: empresa,
      cnpj: cnpj || '',
      telefone: telefone || '',
      responsavel: nome,
    });
    if (cfgErr) throw cfgErr;

    return new Response(JSON.stringify({ ok: true, organization_id: org.id, plan: orgPlan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('signup-tenant error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Erro inesperado' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});