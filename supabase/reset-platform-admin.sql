-- ============================================================
-- RESET PLATFORM ADMIN - LIMPA TUDO E DEIXA SÓ DOUGLAS
-- ============================================================
-- 1. Remove todos os admins da plataforma
DELETE FROM public.platform_admins;

-- 2. Insere o novo admin (usuário já deve existir em auth.users)
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'douglascoutrim@livreos.com'
ON CONFLICT (user_id) DO NOTHING;

-- 3. Atualiza o perfil com o nome correto
UPDATE public.profiles
SET nome = 'Douglas'
WHERE email = 'douglascoutrim@livreos.com';

-- 4. Remove outros admins antigos das tabelas
DELETE FROM public.platform_admins
WHERE user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'douglascoutrim@livreos.com'
);
