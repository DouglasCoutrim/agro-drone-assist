import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ALLOWED_ORIGIN } from '../_shared/cors.ts';

const corsHeadersRestricted = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_PLAN_SLUGS = ['bronze', 'prata', 'ouro'];

// Rate limit store (in-memory, use Redis/Upstash in production)
const rateLimitStore = new Map<string, { count: number; firstRequest: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = 5; // max 5 tentativas por janela

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(key, { count: 1, firstRequest: now });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createCheckoutToken(): Promise<{ token: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = base64Url(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return { token, hash: base64Url(new Uint8Array(digest)) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersRestricted });

  try {
    const { email, password, nome, empresa, telefone, cnpj, plan_slug, captchaToken } = await req.json();

    if (!email || !password || !nome || !empresa) {
      return new Response(JSON.stringify({ ok: false, error: 'Dados obrigatórios ausentes.' }), {
        headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
      });
    }

    const requestedSlug = (plan_slug || 'bronze').toLowerCase();
    if (!VALID_PLAN_SLUGS.includes(requestedSlug)) {
      return new Response(JSON.stringify({ ok: false, error: 'Plano inválido. Escolha Bronze, Prata ou Ouro.' }), {
        status: 400, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting por IP e email
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`signup_ip_${ip}`)) {
      return new Response(JSON.stringify({ ok: false, error: 'Muitas tentativas. Tente novamente em 1 minuto.' }), {
        status: 429, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
      });
    }
    if (!checkRateLimit(`signup_email_${email}`)) {
      return new Response(JSON.stringify({ ok: false, error: 'Muitas tentativas para este email. Tente novamente em 1 minuto.' }), {
        status: 429, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
      });
    }

    // CAPTCHA validation (Cloudflare Turnstile or hCaptcha)
    const captchaSecret = Deno.env.get('CAPTCHA_SECRET');
    if (captchaSecret && captchaToken) {
      try {
        const verifyUrl = `https://challenges.cloudflare.com/turnstile/v0/siteverify`;
        const verifyRes = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: captchaSecret, response: captchaToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return new Response(JSON.stringify({ ok: false, error: 'CAPTCHA inválido. Tente novamente.' }), {
            status: 400, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        // If CAPTCHA verification fails, log but don't block (fallback)
        console.warn('CAPTCHA verification failed:', e);
      }
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create user (email_confirm: false para enviar email de confirmação)
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { nome },
    });
    if (userErr || !created.user) throw userErr || new Error('Falha ao criar usuário');
    const userId = created.user.id;

    // 2. Get plan
    const isTrial = false;
    const lookupSlug = requestedSlug;

    const { data: planRow, error: planErr } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('slug', lookupSlug)
      .eq('active', true)
      .eq('visivel_publicamente', true)
      .eq('cobravel', true)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!planRow) {
      return new Response(JSON.stringify({ ok: false, error: 'Plano indisponível para cadastro público.' }), {
        status: 400, headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
      });
    }

    const plan = planRow ?? { id: null, monthly_price: 0, max_users: 3, max_os_per_month: 100 };
    const orgPlan = isTrial ? 'trial' : requestedSlug;
    const monthlyFee = isTrial ? 0 : (plan.monthly_price ?? 0);

    // 3. Create organization
    const orgSlug = empresa.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
    const { data: org, error: orgErr } = await admin
      .from('organizations').insert({
        owner_id: userId, name: empresa, slug: orgSlug,
        telefone: telefone || null, plan: orgPlan,
        plan_id: isTrial ? null : plan.id ?? null,
        status: 'trial', subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        monthly_fee: monthlyFee, max_users: plan.max_users ?? 3, max_os_per_month: plan.max_os_per_month ?? 100,
      }).select().single();
    if (orgErr || !org) throw orgErr || new Error('Falha ao criar organização');

    // Sessão pública: somente o hash do token é armazenado no banco.
    const checkoutToken = await createCheckoutToken();
    const { error: checkoutError } = await admin.from('checkout_sessions').insert({
      organization_id: org.id,
      plan_slug: isTrial ? 'bronze' : requestedSlug,
      billing_cycle: 'mensal',
      token_hash: checkoutToken.hash,
      status: 'created',
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    if (checkoutError) throw checkoutError;

    // 4. Profile
    const { error: profileErr } = await admin.from('profiles').upsert(
      { id: userId, email, nome, telefone: telefone || null, organization_id: org.id },
      { onConflict: 'id' }
    );
    if (profileErr) throw profileErr;

    const { data: savedProfile, error: savedProfileErr } = await admin.from('profiles').select('organization_id').eq('id', userId).maybeSingle();
    if (savedProfileErr) throw savedProfileErr;
    if (!savedProfile?.organization_id) {
      const { error: fixErr } = await admin.from('profiles').update({ organization_id: org.id }).eq('id', userId);
      if (fixErr) throw fixErr;
    }

    // 5. Role admin
    await admin.from('user_roles').delete().eq('user_id', userId);
    const { error: roleErr } = await admin.from('user_roles').insert({ user_id: userId, role: 'admin' });
    if (roleErr) throw roleErr;

    // 6. user_permissions
    const { error: permErr } = await admin.from('user_permissions').upsert(
      { user_id: userId, acesso_os: true, acesso_estoque: true, acesso_financeiro: true },
      { onConflict: 'user_id' }
    );
    if (permErr) throw permErr;

    // 7. empresa_config
    const { error: cfgErr } = await admin.from('empresa_config').insert({
      owner_id: userId, organization_id: org.id, nome_empresa: empresa,
      cnpj: cnpj || '', telefone: telefone || '', responsavel: nome,
    });
    if (cfgErr) throw cfgErr;

    return new Response(JSON.stringify({ ok: true, organization_id: org.id, plan: orgPlan, emailConfirmed: false, checkout_token: checkoutToken.token }), {
      headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('signup-tenant error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Erro inesperado' }), {
      headers: { ...corsHeadersRestricted, 'Content-Type': 'application/json' },
    });
  }
});
