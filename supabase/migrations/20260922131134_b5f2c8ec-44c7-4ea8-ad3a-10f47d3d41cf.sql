CREATE OR REPLACE FUNCTION private.set_user_roles(_user_id uuid, _roles public.app_role[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  _caller_org uuid;
  _target_org uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar papéis';
  END IF;

  _caller_org := private.get_user_org_id(auth.uid());
  _target_org := private.get_user_org_id(_user_id);
  IF _caller_org IS NULL OR _target_org IS DISTINCT FROM _caller_org THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;

  IF _roles IS NULL OR cardinality(_roles) = 0 OR array_position(_roles, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um papel';
  END IF;

  IF _user_id = auth.uid() AND NOT ('admin'::public.app_role = ANY(_roles)) THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio acesso administrativo';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  SELECT _user_id, role
  FROM unnest(_roles) AS role
  GROUP BY role;
END;
$$;

REVOKE ALL ON FUNCTION private.set_user_roles(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.set_user_roles(uuid, public.app_role[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_roles(_user_id uuid, _roles public.app_role[])
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $$ SELECT private.set_user_roles(_user_id, _roles) $$;

REVOKE ALL ON FUNCTION public.set_user_roles(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_roles(uuid, public.app_role[]) TO authenticated;