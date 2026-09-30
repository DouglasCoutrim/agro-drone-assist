-- =============================================================================
-- FIX generate_os_number (bug de criacao de OS)
-- O trigger antigo fazia CAST(SUBSTRING(numero FROM 6) AS INTEGER) sobre TODAS
-- as OS de todas as organizacoes. Qualquer OS com numero malformado (ex.: criada
-- manualmente ou por outra ferramenta) lancava 'invalid input syntax for type
-- integer' e quebrava o INSERT de OS de qualquer usuario.
-- Novo: escopo por organizacao (multi-tenant) + cast seguro que ignora linhas
-- malformadas em vez de falhar.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  next_number INTEGER;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CASE WHEN SUBSTRING(numero FROM 6) ~ '^[0-9]+$'
         THEN SUBSTRING(numero FROM 6)::INTEGER
         ELSE 0 END
  ), 0) + 1
  INTO next_number
  FROM public.ordens_servico
  WHERE numero LIKE year_prefix || '-%'
    AND (NEW.organization_id IS NULL OR organization_id = NEW.organization_id);

  NEW.numero := year_prefix || '-' || LPAD(next_number::TEXT, 5, '0');
  RETURN NEW;
END;
$$;
