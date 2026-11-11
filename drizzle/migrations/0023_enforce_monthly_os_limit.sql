CREATE OR REPLACE FUNCTION public.enforce_os_monthly_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _max int; _count int;
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(o.max_os_per_month, p.max_os_per_month) INTO _max
  FROM public.organizations o LEFT JOIN public.subscription_plans p ON p.id = o.plan_id
  WHERE o.id = NEW.organization_id;
  IF _max IS NULL OR _max <= 0 THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('os_limit_' || NEW.organization_id::text));
  SELECT COUNT(*) INTO _count FROM public.ordens_servico
  WHERE organization_id = NEW.organization_id AND created_at >= date_trunc('month', now());
  IF _count >= _max THEN
    RAISE EXCEPTION 'Limite mensal de % ordens de serviço do seu plano foi atingido.', _max USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_os_monthly_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_os_monthly_limit ON public.ordens_servico;
CREATE TRIGGER trg_enforce_os_monthly_limit BEFORE INSERT ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.enforce_os_monthly_limit();