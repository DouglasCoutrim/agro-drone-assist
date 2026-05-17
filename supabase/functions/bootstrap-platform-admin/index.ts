// One-shot bootstrap to create an isolated Super Admin user.
// Protected by SUPABASE_SERVICE_ROLE_KEY in the x-bootstrap-key header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Try create user, or find existing
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: "Super Admin" },
    });
    if (createErr) {
      // user may already exist - look it up
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = existing.id;
      // reset password
      await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    // Detach from any organization (isolated super admin)
    await supabase.from("profiles").update({ organization_id: null }).eq("id", userId!);

    // Insert into platform_admins
    const { error: paErr } = await supabase
      .from("platform_admins")
      .upsert({ user_id: userId! }, { onConflict: "user_id" });
    if (paErr) {
      return new Response(JSON.stringify({ error: paErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
