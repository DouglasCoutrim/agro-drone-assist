
-- Fix: Restrict clientes SELECT to admin and tecnico roles only
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;

CREATE POLICY "Admin and tecnico can view clientes"
  ON public.clientes
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));
