-- =============================================================================
-- FIX: RLS Policies for organizations table
-- Garante que usuários vejam apenas sua própria org e admins vejam todas
-- =============================================================================

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Org members view own org" ON public.organizations;
DROP POLICY IF EXISTS "Admins view all organizations" ON public.organizations;

-- Policy: Any authenticated user can view their own organization
CREATE POLICY "Org members view own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org_id(auth.uid()));

-- Policy: Admins can view all organizations (for admin panel display)
CREATE POLICY "Admins view all organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Grant permissions
GRANT SELECT ON public.organizations TO authenticated;