
-- Fix user_permissions: change from public to authenticated
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage all permissions"
  ON public.user_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles: add WITH CHECK to ALL policy
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
