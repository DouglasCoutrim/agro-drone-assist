import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ALLOWED_ORIGIN } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Não autorizado' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Sessão inválida' }, 401);

    const { data: platformAdmin, error: platformError } = await admin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (platformError || !platformAdmin) return json({ error: 'Apenas administradores da plataforma podem executar esta operação' }, 403);

    const { target_user_id: targetUserId, new_password: newPassword, reason } = await req.json();
    if (typeof targetUserId !== 'string' || !targetUserId || typeof newPassword !== 'string' || newPassword.length < 8) {
      return json({ error: 'Informe o usuário e uma senha com pelo menos 8 caracteres' }, 400);
    }
    if (typeof reason !== 'string' || !reason.trim()) return json({ error: 'O motivo é obrigatório' }, 400);

    const { data: targetProfile, error: profileError } = await admin
      .from('profiles')
      .select('id,organization_id,email')
      .eq('id', targetUserId)
      .maybeSingle();
    if (profileError || !targetProfile) return json({ error: 'Usuário não encontrado' }, 404);

    const { data: updatedUser, error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (updateError || !updatedUser.user) throw updateError || new Error('Não foi possível atualizar a senha');

    const { error: auditError } = await admin.from('admin_audit_log').insert({
      action: 'tenant_password_reset_manual',
      organization_id: targetProfile.organization_id,
      target_id: targetUserId,
      performed_by: authData.user.id,
      details: { reason: reason.trim(), target_email: targetProfile.email },
    });
    if (auditError) throw auditError;

    return json({ ok: true });
  } catch (error) {
    console.error('admin-reset-tenant-password error', error);
    return json({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});
