import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const email = "douglascoutrim@livreos.com";
  const password = "98751344@";

  // Check if user already exists
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: "Douglas" },
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    user = data.user!;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password });
  }

  // Promote to platform admin
  const { error: padErr } = await admin
    .from("platform_admins")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });

  if (padErr) {
    return new Response(JSON.stringify({ error: padErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, user_id: user.id, email, password }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
