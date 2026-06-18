ALTER TABLE public.empresa_config ALTER COLUMN organization_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS empresa_config_organization_id_key ON public.empresa_config(organization_id);