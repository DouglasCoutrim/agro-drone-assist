-- Corrige o organization_id dos membros que estão sem vínculo com a empresa
-- Primeiro, descobre o organization_id do admin (douglas@livreos.local)
-- Depois aplica para a sara@voltmaster.com

DO $$
DECLARE
  admin_org_id UUID;
BEGIN
  SELECT organization_id INTO admin_org_id FROM public.profiles WHERE email = 'douglas@livreos.local';

  IF admin_org_id IS NULL THEN
    RAISE EXCEPTION 'Admin sem organization_id. Verifique o perfil do admin.';
  END IF;

  UPDATE public.profiles
  SET organization_id = admin_org_id
  WHERE email = 'sara@voltmaster.com' AND organization_id IS NULL;

  IF NOT FOUND THEN
    RAISE NOTICE 'Nenhum perfil encontrado para sara@voltmaster.com ou organization_id já definido.';
  ELSE
    RAISE NOTICE 'organization_id atualizado com sucesso para sara@voltmaster.com';
  END IF;
END $$;
