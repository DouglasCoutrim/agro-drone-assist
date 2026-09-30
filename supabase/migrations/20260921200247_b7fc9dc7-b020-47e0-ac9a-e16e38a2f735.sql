ALTER TABLE public.itens_estoque
  DROP CONSTRAINT IF EXISTS itens_estoque_codigo_key;

ALTER TABLE public.itens_estoque
  ADD CONSTRAINT itens_estoque_organization_codigo_key
  UNIQUE (organization_id, codigo);