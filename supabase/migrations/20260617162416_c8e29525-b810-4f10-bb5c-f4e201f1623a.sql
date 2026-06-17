
-- Backfill organization_id em itens_os a partir da OS pai (corrige PDF vazio)
UPDATE public.itens_os i
SET organization_id = o.organization_id
FROM public.ordens_servico o
WHERE i.ordem_servico_id = o.id
  AND i.organization_id IS NULL
  AND o.organization_id IS NOT NULL;

-- Trigger: garantir que todo INSERT em itens_os herde o organization_id da OS
CREATE OR REPLACE FUNCTION public.set_itens_os_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.ordens_servico
    WHERE id = NEW.ordem_servico_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_itens_os_org ON public.itens_os;
CREATE TRIGGER trg_set_itens_os_org
BEFORE INSERT ON public.itens_os
FOR EACH ROW EXECUTE FUNCTION public.set_itens_os_org();
