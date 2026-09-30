-- Expand user_permissions table with all system functionalities
-- Add new columns for feature-level access control

ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_dashboard boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_meu_painel boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_oficina_vivo boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_clientes boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_servicos boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_cobrancas boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_orcamentos boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_rotas boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_relatorios boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_equipe boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_empresa boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_configuracoes boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_checklist boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_notificacoes boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_wiki boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS acesso_suporte boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Update existing records to set new columns to true by default
UPDATE public.user_permissions
SET
  acesso_dashboard = true,
  acesso_meu_painel = true,
  acesso_oficina_vivo = true,
  acesso_clientes = true,
  acesso_servicos = true,
  acesso_cobrancas = false,
  acesso_orcamentos = true,
  acesso_rotas = true,
  acesso_relatorios = true,
  acesso_equipe = true,
  acesso_empresa = true,
  acesso_configuracoes = true,
  acesso_checklist = true,
  acesso_notificacoes = true,
  acesso_wiki = true,
  acesso_suporte = true
WHERE acesso_dashboard IS NULL;

-- Update trigger to handle new columns
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

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_user_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_permissions_updated_at();

-- Grant permissions remain the same
GRANT SELECT, INSERT, UPDATE ON public.user_permissions TO authenticated;