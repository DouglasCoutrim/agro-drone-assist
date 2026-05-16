
-- Profiles: scope admin policies to same organization
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can view org profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND organization_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Admins can insert org profiles"
ON public.profiles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND organization_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Admins can delete org profiles"
ON public.profiles FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  AND organization_id = public.get_user_org_id(auth.uid())
);

-- user_roles: scope admin management to users within same organization
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can view org user roles"
ON public.user_roles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Admins can insert org user roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Admins can update org user roles"
ON public.user_roles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Admins can delete org user roles"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
);

-- Platform admins retain full access
CREATE POLICY "Platform admins manage all user roles"
ON public.user_roles FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));
