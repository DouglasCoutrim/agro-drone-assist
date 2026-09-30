
-- Fix PUBLIC_DATA_EXPOSURE: Restrict overly permissive SELECT policies

-- itens_estoque
DROP POLICY IF EXISTS "Authenticated users can view estoque" ON public.itens_estoque;
CREATE POLICY "Admin and tecnico can view estoque"
  ON public.itens_estoque FOR SELECT TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

-- ordens_servico
DROP POLICY IF EXISTS "Authenticated users can view OS" ON public.ordens_servico;
CREATE POLICY "Admin and tecnico can view OS"
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

-- movimentacoes_estoque
DROP POLICY IF EXISTS "Authenticated users can view movimentacoes" ON public.movimentacoes_estoque;
CREATE POLICY "Admin and tecnico can view movimentacoes"
  ON public.movimentacoes_estoque FOR SELECT TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

-- os_anexos
DROP POLICY IF EXISTS "Authenticated users can view anexos" ON public.os_anexos;
CREATE POLICY "Admin and tecnico can view anexos"
  ON public.os_anexos FOR SELECT TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));

-- os_historico
DROP POLICY IF EXISTS "Authenticated users can view historico" ON public.os_historico;
CREATE POLICY "Admin and tecnico can view historico"
  ON public.os_historico FOR SELECT TO authenticated
  USING (public.is_admin_or_tecnico(auth.uid()));
