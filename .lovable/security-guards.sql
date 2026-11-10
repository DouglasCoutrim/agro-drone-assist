-- Proposed SQL for the active external backend; requires user approval.
BEGIN;
CREATE TABLE IF NOT EXISTS public.push_dispatch_authorizations (
  notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  used_at timestamptz
);
GRANT ALL ON public.push_dispatch_authorizations TO service_role;
REVOKE ALL ON public.push_dispatch_authorizations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.push_dispatch_authorizations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_push_dispatch(_notification_id uuid, _token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE consumed uuid;
BEGIN
  UPDATE public.push_dispatch_authorizations SET used_at = now()
  WHERE notification_id = _notification_id AND token = _token
    AND used_at IS NULL AND expires_at > now()
  RETURNING notification_id INTO consumed;
  RETURN consumed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_push_dispatch(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_push_dispatch(uuid, uuid) TO service_role;

-- Preserve the active deployment URL and transport header without copying
-- credentials into SQL files. Add a one-time authorization capability.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.trg_send_web_push()'::regprocedure) INTO definition;
  IF position('dispatch_token' IN definition) = 0 THEN
    IF position('BEGIN' IN definition) = 0 OR
       definition !~ 'jsonb_build_object\(''notification_id'',\s*NEW.id\)' THEN
      RAISE EXCEPTION 'Unexpected push trigger definition; review before applying';
    END IF;
    definition := replace(definition, 'BEGIN', 'DECLARE dispatch_token uuid; BEGIN');
    definition := replace(definition, 'PERFORM net.http_post(',
      'INSERT INTO public.push_dispatch_authorizations(notification_id) VALUES (NEW.id) RETURNING token INTO dispatch_token; PERFORM net.http_post(');
    definition := regexp_replace(definition,
      'jsonb_build_object\(''notification_id'',\s*NEW.id\)',
      'jsonb_build_object(''notification_id'', NEW.id, ''dispatch_token'', dispatch_token)');
    EXECUTE definition;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_send_web_push() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_organization_plan_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid; plan_slug text; maximum integer; used bigint;
BEGIN
  org := NEW.organization_id;
  IF org IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME = 'ordens_servico' AND TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN RETURN NEW; END IF;
  END IF;
  IF auth.role() = 'authenticated' AND
     org IS DISTINCT FROM public.get_user_org_id(auth.uid()) AND
     NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  -- Serialize quota-changing writes within each organization.
  SELECT CASE WHEN plan = 'trial' THEN 'bronze' ELSE plan END INTO plan_slug
    FROM public.organizations WHERE id = org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  IF public.is_platform_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'ordens_servico' THEN
    SELECT max_os_per_month INTO maximum FROM public.subscription_plans WHERE slug = plan_slug;
    IF auth.role() = 'authenticated' AND TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
    IF auth.role() = 'authenticated' AND TG_OP = 'UPDATE'
       AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Não é permitido alterar a data de criação da OS';
    END IF;
    SELECT count(*) INTO used FROM public.ordens_servico
      WHERE organization_id = org AND id IS DISTINCT FROM NEW.id
      AND created_at >= date_trunc('month', NEW.created_at)
      AND created_at < date_trunc('month', NEW.created_at) + interval '1 month';
  ELSE
    SELECT max_users INTO maximum FROM public.subscription_plans WHERE slug = plan_slug;
    SELECT count(*) INTO used FROM public.profiles
      WHERE organization_id = org AND id IS DISTINCT FROM NEW.id;
  END IF;
  IF maximum IS NULL THEN RAISE EXCEPTION 'Não foi possível verificar o limite do plano'; END IF;
  IF maximum <> -1 AND used >= maximum THEN RAISE EXCEPTION 'Limite do plano atingido'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_organization_plan_limits() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.ordens_servico'::regclass AND tgname = 'enforce_os_plan_limit') THEN
    CREATE TRIGGER enforce_os_plan_limit BEFORE INSERT OR UPDATE OF organization_id, created_at
      ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_plan_limits();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'enforce_member_plan_limit') THEN
    CREATE TRIGGER enforce_member_plan_limit BEFORE INSERT OR UPDATE OF organization_id
      ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_plan_limits();
  END IF;
END;
$$;
COMMIT;