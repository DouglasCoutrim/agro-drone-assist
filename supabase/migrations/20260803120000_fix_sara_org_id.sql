-- Corrige o organization_id da Sara
-- Primeiro descobre qual organização existe
DO $$
DECLARE
  target_org_id UUID;
BEGIN
  -- Pega a primeira organização disponível (ajuste o nome se necessário)
  SELECT id INTO target_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organização encontrada. Crie uma empresa primeiro.';
  END IF;

  -- Atualiza a Sara com o organization_id correto
  UPDATE public.profiles
  SET organization_id = target_org_id
  WHERE email = 'sara@voltmaster.com' AND organization_id IS NULL;

  IF NOT FOUND THEN
    RAISE NOTICE 'Nenhum perfil encontrado para sara@voltmaster.com ou já possui organization_id.';
  ELSE
    RAISE NOTICE 'organization_id % definido para sara@voltmaster.com', target_org_id;
  END IF;
END $$;