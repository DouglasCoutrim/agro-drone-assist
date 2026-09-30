-- =============================================================================
-- FIX: Main user organization_id linkage recovery
-- Ensures the primary platform admin user is properly linked to their organization
-- =============================================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_target_org_id UUID;
BEGIN
  -- Pega o ID do usuário platform admin (douglascoutrim@livreos.com)
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'douglascoutrim@livreos.com';

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'Usuário platform admin douglascoutrim@livreos.com não encontrado.';
    RETURN;
  END IF;

  -- Tenta encontrar a organização através do owner_id na tabela organizations
  -- ou através do profiles organization_id existente
  SELECT organization_id INTO v_target_org_id
  FROM public.profiles
  WHERE id = v_admin_id;

  IF v_target_org_id IS NULL THEN
    -- Se organization_id for NULL, tenta associar à organização onde este usuário é owner
    SELECT id INTO v_target_org_id FROM public.organizations WHERE owner_id = v_admin_id LIMIT 1;

    IF v_target_org_id IS NULL THEN
      RAISE NOTICE 'Nenhuma organização encontrada para o user admin. Verifique se há uma organização com owner_id corresp.';
      RETURN;
    END IF;

    -- Atualiza o perfil do admin com a organização correta
    UPDATE public.profiles
    SET organization_id = v_target_org_id
    WHERE id = v_admin_id;

    RAISE NOTICE 'organization_id % definido para o admin douglascoutrim@livreos.com', v_target_org_id;
  ELSE
    RAISE NOTICE 'O admin ja possui organization_id %', v_target_org_id;
  END IF;

  -- Garante que o usuário tem o papel admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_admin_id AND role = 'admin'::public.app_role
  ) THEN
    DELETE FROM public.user_roles WHERE user_id = v_admin_id AND role = 'consulta'::public.app_role;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_id, 'admin'::public.app_role);
    RAISE NOTICE 'Papel admin concedido ao user douglascoutrim@livreos.com';
  ELSE
    RAISE NOTICE 'O user ja possui o papel admin.';
  END IF;

  -- Garante que há uma linha em user_permissions
  INSERT INTO public.user_permissions (user_id)
  VALUES (v_admin_id)
  ON CONFLICT (user_id) DO NOTHING;
END $$;