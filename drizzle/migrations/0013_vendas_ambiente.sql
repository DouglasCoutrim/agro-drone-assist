ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS ambiente text NOT NULL DEFAULT 'producao';
CREATE INDEX IF NOT EXISTS idx_vendas_ambiente ON public.vendas(organization_id, ambiente);