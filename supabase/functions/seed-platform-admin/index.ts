import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require a bearer key configured server-side (never hardcode credentials).
  const secret = Deno.env.get("SEED_ADMIN_KEY");
  if (!secret) {
    return new Response(
      JSON.stringify({ error: "SEED_ADMIN_KEY não configurada. Defina a variável no projeto antes de usar." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.replace(/^Bearer\s+/i, "") !== secret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const email = Deno.env.get("SEED_ADMIN_EMAIL");
  const password = Deno.env.get("SEED_ADMIN_PASSWORD");
  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: "SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não configuradas." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    // Never reset an existing admin's password on every call.
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: "Administrador" },
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = data.user!.id;
  }

  const { error: padErr } = await admin
    .from("platform_admins")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (padErr) {
    return new Response(JSON.stringify({ error: padErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, user_id: userId, email }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
