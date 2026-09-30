-- =============================================================================
-- SANEAMENTO DE CONTAS ÓRFÃS (bug do cadastro em trial)
-- Sintoma: contas criadas pelo fluxo self-service falhavam ao cadastrar
-- produtos/categorias/clientes (toast genérico de erro, nada era salvo). O RLS
-- org-scope exige `profiles.organization_id` preenchido; quando a criação da
-- empresa falhava parcialmente, o perfil ficava com organization_id NULL e TODA
-- gravação de negócio era bloqueada silenciosamente pelo RLS.
-- Este script vincula perfis órfãos à organização da qual são donos, garante o
-- papel 'admin' e a linha em user_permissions. Idempotente.
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
    UPDATE public.profiles
    SET organization_id = r.org_id
    WHERE id = r.user_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = r.user_id AND role = 'admin'::public.app_role
    ) THEN
      DELETE FROM public.user_roles WHERE user_id = r.user_id AND role = 'consulta'::public.app_role;
      INSERT INTO public.user_roles (user_id, role) VALUES (r.user_id, 'admin'::public.app_role);
    END IF;

    INSERT INTO public.user_permissions (user_id)
    VALUES (r.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;