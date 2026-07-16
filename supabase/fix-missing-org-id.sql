-- Corrige o organization_id dos membros que estão sem vínculo com a empresa
DO $$
DECLARE
  admin_org_id UUID;
BEGIN
  -- Tenta buscar o organization_id do perfil do admin
  SELECT organization_id INTO admin_org_id FROM public.profiles WHERE email = 'douglascoutrim@livreos.com';

  -- Se o admin não tem organization_id, busca da tabela organizations
  IF admin_org_id IS NULL THEN
    SELECT id INTO admin_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF admin_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organização encontrada. Crie uma empresa primeiro.';
  END IF;

  -- Atualiza o perfil do admin com o organization_id
  UPDATE public.profiles
  SET organization_id = admin_org_id
  WHERE email = 'douglascoutrim@livreos.com' AND organization_id IS NULL;

  -- Atualiza a Sara
  UPDATE public.profiles
  SET organization_id = admin_org_id
  WHERE email = 'sara@voltmaster.com' AND organization_id IS NULL;

  RAISE NOTICE 'organization_id % definido para os perfis.', admin_org_id;
END $$;
