ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itens jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0;