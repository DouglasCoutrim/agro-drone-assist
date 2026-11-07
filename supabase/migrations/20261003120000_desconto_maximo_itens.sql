-- Desconto máximo por item (peças e serviços) e desconto por item em OS.
-- O administrador define o teto de desconto (%) de cada item; ao aplicar um
-- desconto em orçamento/OS/venda, o percentual é limitado a esse teto.
-- Migração idempotente.

ALTER TABLE public.itens_estoque
  ADD COLUMN IF NOT EXISTS desconto_maximo_percentual numeric NOT NULL DEFAULT 0;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS desconto_maximo_percentual numeric NOT NULL DEFAULT 0;

ALTER TABLE public.itens_os
  ADD COLUMN IF NOT EXISTS desconto_maximo_percentual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_valor numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.itens_estoque.desconto_maximo_percentual IS 'Teto de desconto (%) definido pelo administrador para o item.';
COMMENT ON COLUMN public.servicos.desconto_maximo_percentual IS 'Teto de desconto (%) definido pelo administrador para o serviço.';
