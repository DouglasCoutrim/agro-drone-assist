import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const CreateUserSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  senha: z.string().min(8).max(128),
  roles: z.array(z.enum(["admin", "tecnico", "consulta"])).min(1).max(3),
  responsabilidades: z.string().trim().max(2000).optional(),
  permissions: z.object({
    acesso_dashboard: z.boolean(), acesso_os: z.boolean(), acesso_meu_painel: z.boolean(), acesso_oficina_vivo: z.boolean(),
    acesso_clientes: z.boolean(), acesso_estoque: z.boolean(), acesso_servicos: z.boolean(), acesso_financeiro: z.boolean(),
    acesso_cobrancas: z.boolean(), acesso_orcamentos: z.boolean(), acesso_rotas: z.boolean(), acesso_relatorios: z.boolean(),
    acesso_equipe: z.boolean(), acesso_empresa: z.boolean(), acesso_configuracoes: z.boolean(), acesso_checklist: z.boolean(),
    acesso_notificacoes: z.boolean(), acesso_wiki: z.boolean(), acesso_suporte: z.boolean(),
  }).strict().optional(),
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const friendlyAuthError = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("weak") || normalized.includes("easy to guess")) {
    return "Esta senha é muito comum ou fácil de adivinhar. Escolha uma senha mais forte e exclusiva.";
  }
  if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
    return "Este e-mail já está cadastrado.";
  }
  return message;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their token
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return jsonResponse({ error: "Sessão inválida ou expirada" }, 401);
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return jsonResponse({ error: "Apenas administradores podem criar usuários" }, 403);
    }

    const parsed = CreateUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ error: "Confira nome, e-mail, senha e função. A senha deve ter pelo menos 8 caracteres." }, 400);
    }
    const { nome, email, senha, roles, responsabilidades, permissions } = parsed.data;

    // Look up the caller's organization_id to scope the new member
    const { data: callerProfile, error: profileLookupError } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileLookupError || !callerProfile?.organization_id) {
      return jsonResponse({ error: "Seu usuário não está vinculado a uma empresa." }, 400);
    }

    // Create the user with admin API (auto-confirms email)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createError) {
      return jsonResponse({ error: friendlyAuthError(createError.message) }, 400);
    }

    const newUserId = newUser.user.id;
    try {
      // The handle_new_user trigger creates profile + default role ('consulta').
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ organization_id: callerProfile.organization_id, responsabilidades: responsabilidades ?? "" })
        .eq("id", newUserId);
      if (profileError) throw profileError;

      const { error: roleDeleteError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", newUserId);
      if (roleDeleteError) throw roleDeleteError;

      const uniqueRoles = [...new Set(roles)];
      const { error: roleInsertError } = await adminClient
        .from("user_roles")
        .insert(uniqueRoles.map((assignedRole) => ({ user_id: newUserId, role: assignedRole })));
      if (roleInsertError) throw roleInsertError;

      const { error: permissionsError } = await adminClient
        .from("user_permissions")
        .upsert({ user_id: newUserId, ...permissions }, { onConflict: "user_id" });
      if (permissionsError) throw permissionsError;
    } catch (setupError) {
      console.error("Failed to finish member setup", setupError);
      await adminClient.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: "Não foi possível concluir o cadastro. Nenhuma conta incompleta foi mantida." }, 500);
    }

    return jsonResponse({ success: true, user_id: newUserId });
  } catch (err) {
    console.error("Internal error creating user:", err);
    return jsonResponse({ error: "Erro interno ao criar usuário" }, 500);
  }
});
