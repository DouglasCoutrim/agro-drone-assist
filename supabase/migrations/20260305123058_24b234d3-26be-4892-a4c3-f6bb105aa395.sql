
-- Table for module-level permissions per user
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  acesso_os boolean NOT NULL DEFAULT true,
  acesso_estoque boolean NOT NULL DEFAULT true,
  acesso_financeiro boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage all permissions  
CREATE POLICY "Admins can manage all permissions"
  ON public.user_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create permissions for new users via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Insert permissions for existing users
INSERT INTO public.user_permissions (user_id)
SELECT id FROM public.profiles
ON CONFLICT DO NOTHING;
