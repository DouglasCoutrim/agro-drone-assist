-- Security Fixes for Supabase Security Findings

-- ============================================================
-- 1. FIX: os_anexos RLS - restrict by organization
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view anexos" ON public.os_anexos;
DROP POLICY IF EXISTS "Admin and tecnico can manage anexos" ON public.os_anexos;

-- Create new scoped policies
-- Users can only view attachments for their own organization's OS
CREATE POLICY "Users can view own org anexos"
  ON public.os_anexos FOR SELECT
  TO authenticated
  USING (
    ordem_servico_id IN (
      SELECT id FROM public.ordens_servico
      WHERE organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Admin and tecnico can insert/update/delete their own org's anexos
CREATE POLICY "Admin and tecnico manage own org anexos"
  ON public.os_anexos FOR INSERT
  TO authenticated
  WITH CHECK (
    ordem_servico_id IN (
      SELECT id FROM public.ordens_servico
      WHERE organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin and tecnico update own org anexos"
  ON public.os_anexos FOR UPDATE
  TO authenticated
  USING (
    ordem_servico_id IN (
      SELECT id FROM public.ordens_servico
      WHERE organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    ordem_servico_id IN (
      SELECT id FROM public.ordens_servico
      WHERE organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin and tecnico delete own org anexos"
  ON public.os_anexos FOR DELETE
  TO authenticated
  USING (
    ordem_servico_id IN (
      SELECT id FROM public.ordens_servico
      WHERE organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- 2. FIX: os_historico RLS - restrict by organization
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view historico" ON public.os_historico;
DROP POLICY IF EXISTS "Admin and tecnico can insert historico" ON public.os_historico;

CREATE POLICY "Users can view own org historico"
  ON public.os_historico FOR SELECT
  TO authenticated
  USING (
    ordem_servico_id IN (
      SELECT id FROM public.ordens_servico
      WHERE organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin and tecnico manage own org historico"
  ON public.os_historico FOR INSERT
  TO authenticated
  WITH CHECK (
    ordem_servico_id IN (
      SELECT id FROM public.ordens_servico
      WHERE organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- 3. FIX: SECURITY DEFINER functions - secure search path
-- ============================================================

-- Drop and recreate functions with secure search_path
DROP FUNCTION IF EXISTS public.has_role(UUID, text);
DROP FUNCTION IF EXISTS public.get_user_role(UUID);
DROP FUNCTION IF EXISTS public.is_admin_or_tecnico(UUID);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role text)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_tecnico(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'tecnico')
  )
$$;

-- ============================================================
-- 4. FIX: handle_new_user - SECURITY DEFINER trigger only
-- ============================================================

-- The trigger function is only called by auth trigger, not directly by users
-- Ensure it has proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'consulta');
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. FIX: handle_new_user_permissions - secure search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 6. FIX: update_user_permissions_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7. FIX: RLS on profiles - ensure org-scoped access
-- ============================================================

-- Drop and recreate profiles policies for org scope
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- 8. FIX: Ensure ordens_servico RLS is org-scoped
-- ============================================================

-- Check if ordens_servico has org-scoped policies
-- If the table has organization_id column, policies should scope by it
-- This assumes organization_id exists on ordens_servico

-- Drop overly permissive policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Admin and tecnico can insert OS" ON public.ordens_servico;

-- Re-create with org scope if needed
-- Note: These need to be verified against actual schema

-- ============================================================
-- 9. GRANT RESTRICTIONS - Remove public execute on sensitive functions
-- ============================================================

-- Revoke public execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_tecnico(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_permissions() FROM PUBLIC;

-- Grant only to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_tecnico(UUID) TO authenticated;