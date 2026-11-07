DROP TRIGGER IF EXISTS trg_enforce_itens_os_price ON public.itens_os;
CREATE TRIGGER trg_zz_enforce_itens_os_price BEFORE INSERT OR UPDATE ON public.itens_os
FOR EACH ROW EXECUTE FUNCTION public.enforce_itens_os_price();