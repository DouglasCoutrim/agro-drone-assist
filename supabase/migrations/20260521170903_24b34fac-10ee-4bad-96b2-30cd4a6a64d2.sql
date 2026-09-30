-- Garante que o usuário é um administrador da plataforma
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'douglascoutrim@outlook.com'
ON CONFLICT (user_id) DO NOTHING;