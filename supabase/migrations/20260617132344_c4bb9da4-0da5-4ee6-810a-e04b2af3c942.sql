-- Dedupe duplicate empresa_config rows per organization, keep most recent
WITH ranked AS (
  SELECT id, organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
  FROM public.empresa_config
  WHERE organization_id IS NOT NULL
)
DELETE FROM public.empresa_config ec
USING ranked r
WHERE ec.id = r.id AND r.rn > 1;

-- Enforce single config per organization
CREATE UNIQUE INDEX IF NOT EXISTS empresa_config_organization_id_key
  ON public.empresa_config(organization_id);