-- Adiciona o usuário douglas@livreos.local como administrador da plataforma
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'douglas@livreos.local'
ON CONFLICT (user_id) DO NOTHING;
