-- =============================================================================
-- DIAGNÓSTICO: contas que não conseguem salvar dados (produtos/categorias/etc.)
-- Rode no SQL Editor do Supabase. Retorna usuários com perfil órfão
-- (profiles.organization_id NULL) ou sem papel admin/tecnico — condições que
-- fazem o RLS bloquear TODAS as gravações do usuário.
-- =============================================================================

SELECT
  u.id AS user_id,
  u.email,
  u.created_at,
  p.organization_id AS profile_org,
  COALESCE((
    SELECT string_agg(role::text, ',') FROM public.user_roles WHERE user_id = u.id
  ), '(sem papel)') AS roles,
  (SELECT o.name FROM public.organizations o WHERE o.id = p.organization_id) AS org_name,
  EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = u.id) AS has_permissions
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE p.organization_id IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM public.user_roles
     WHERE user_id = u.id AND role IN ('admin'::public.app_role, 'tecnico'::public.app_role)
   )
ORDER BY u.created_at DESC;