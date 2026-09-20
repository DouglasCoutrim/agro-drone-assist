-- =============================================================================
-- FIX: Saneamento de perfis órfãos (organization_id NULL)
-- Vincula perfis órfãos à organização correta baseada no owner_id
-- Também garante o papel 'admin' e a linha em user_permissions
-- Idempotente.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, o.id AS org_id
    FROM public.profiles p
    JOIN public.organizations o ON o.owner_id = p.id
    WHERE p.organization_id IS NULL
  LOOP
    -- Vincula o organization_id ao perfil
    UPDATE public.profiles
    SET organization_id = r.org_id
    WHERE id = r.user_id;

    -- Garante o papel 'admin' (remove 'consulta' se existir e insere 'admin')
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = r.user_id AND role = 'admin'::public.app_role
    ) THEN
      DELETE FROM public.user_roles WHERE user_id = r.user_id AND role = 'consulta'::public.app_role;
      INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, 'admin'::public.app_role);
    END IF;

    -- Garante que há uma linha em user_permissions
    INSERT INTO public.user_permissions (user_id)
    VALUES (r.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;