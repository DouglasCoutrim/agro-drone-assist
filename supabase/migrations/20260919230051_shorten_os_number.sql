-- =============================================================================
-- SHORTEN OS NUMBER FORMAT (Prompt 3 - compactação)
-- Formato atual: 2025-00001 (9 caracteres com ano)
-- Novo formato: OS-00001 (7 caracteres, mais curto e legível)
-- Idempotente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Busca o próximo número sequencial por organização
  SELECT COALESCE(MAX(
    CASE WHEN SUBSTRING(numero FROM 7) ~ '^[0-9]+$'
         THEN SUBSTRING(numero FROM 7)::INTEGER
         ELSE 0 END
  ), 0) + 1
  INTO next_number
  FROM public.ordens_servico
  WHERE numero LIKE 'OS-%'
    AND (NEW.organization_id IS NULL OR organization_id = NEW.organization_id);

  -- Formato curto: OS-NNNNN
  NEW.numero := 'OS-' || LPAD(next_number::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- Atualiza trigger existente
DROP TRIGGER IF EXISTS generate_os_number_trigger ON public.ordens_servico;
CREATE TRIGGER generate_os_number_trigger
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION public.generate_os_number();
