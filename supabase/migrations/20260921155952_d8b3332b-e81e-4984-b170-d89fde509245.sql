ALTER FUNCTION public.get_user_org_id(uuid) SECURITY DEFINER;
ALTER FUNCTION public.get_user_org_id(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_role(uuid) SECURITY DEFINER;
ALTER FUNCTION public.get_user_role(uuid) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY DEFINER;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.is_admin_or_tecnico(uuid) SECURITY DEFINER;
ALTER FUNCTION public.is_admin_or_tecnico(uuid) SET search_path = public;
ALTER FUNCTION public.is_platform_admin(uuid) SECURITY DEFINER;
ALTER FUNCTION public.is_platform_admin(uuid) SET search_path = public;

REVOKE ALL ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_or_tecnico(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_tecnico(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;