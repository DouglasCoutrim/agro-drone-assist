-- Adiciona o usuário douglascoutrim@livreos.com como administrador da plataforma
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'douglascoutrim@livreos.com'
ON CONFLICT (user_id) DO NOTHING;
