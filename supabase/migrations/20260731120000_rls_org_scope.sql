-- =============================================================================
-- RLS ORG-SCOPE (C1, C2, A5, A9)
-- Substitui policies baseadas apenas em role (que vazavam dados entre
-- organizacoes) por policies que combinam role + organization_id do usuario.
-- Tambem corrige as RPCs count_* (C9) para nao vazar contagens entre orgs.
-- Idempotente.
-- =============================================================================

-- 1. organizations: membros da propria org podem ver a propria org ----------
DROP POLICY IF EXISTS "Org members view own org" ON public.organizations;
CREATE POLICY "Org members view own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org_id(auth.uid()));

-- 2. clientes ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admin and tecnico can view clientes" ON public.clientes;
CREATE POLICY "Org members view clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can update clientes" ON public.clientes;
CREATE POLICY "Org admin_tecnico update clientes"
  ON public.clientes FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

DROP POLICY IF EXISTS "Admin can delete clientes" ON public.clientes;
CREATE POLICY "Org admin delete clientes"
  ON public.clientes FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3. itens_estoque -----------------------------------------------------------
DROP POLICY IF EXISTS "Admin and tecnico can view estoque" ON public.itens_estoque;
CREATE POLICY "Org members view estoque"
  ON public.itens_estoque FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can manage estoque" ON public.itens_estoque;
CREATE POLICY "Org admin_tecnico manage estoque"
  ON public.itens_estoque FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- 4. ordens_servico -----------------------------------------------------------
DROP POLICY IF EXISTS "Admin and tecnico can view OS" ON public.ordens_servico;
CREATE POLICY "Org members view OS"
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can update OS" ON public.ordens_servico;
CREATE POLICY "Org admin_tecnico update OS"
  ON public.ordens_servico FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

DROP POLICY IF EXISTS "Admin can delete OS" ON public.ordens_servico;
CREATE POLICY "Org admin delete OS"
  ON public.ordens_servico FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- 5. movimentacoes_estoque (append-only: No updates/deletes mantidos) --------
DROP POLICY IF EXISTS "Admin and tecnico can view movimentacoes" ON public.movimentacoes_estoque;
CREATE POLICY "Org members view movimentacoes"
  ON public.movimentacoes_estoque FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can insert movimentacoes" ON public.movimentacoes_estoque;
CREATE POLICY "Org admin_tecnico insert movimentacoes"
  ON public.movimentacoes_estoque FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- 6. financeiro ---------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can manage financeiro" ON public.financeiro;
CREATE POLICY "Org admin manage financeiro"
  ON public.financeiro FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Tecnico can view financeiro" ON public.financeiro;
CREATE POLICY "Org admin_tecnico view financeiro"
  ON public.financeiro FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- 7. os_anexos ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admin and tecnico can view anexos" ON public.os_anexos;
CREATE POLICY "Org members view anexos"
  ON public.os_anexos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can manage anexos" ON public.os_anexos;
CREATE POLICY "Org admin_tecnico manage anexos"
  ON public.os_anexos FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- 8. os_historico (append-only) ------------------------------------------------
DROP POLICY IF EXISTS "Admin and tecnico can view historico" ON public.os_historico;
CREATE POLICY "Org members view historico"
  ON public.os_historico FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can insert historico" ON public.os_historico;
CREATE POLICY "Org admin_tecnico insert historico"
  ON public.os_historico FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- 9. orcamentos ---------------------------------------------------------------
DROP POLICY IF EXISTS "Admin and tecnico can manage orcamentos" ON public.orcamentos;
CREATE POLICY "Org admin_tecnico manage orcamentos"
  ON public.orcamentos FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can view orcamentos" ON public.orcamentos;
CREATE POLICY "Org members view orcamentos"
  ON public.orcamentos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- 10. rotas -------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin and tecnico can manage rotas" ON public.rotas;
CREATE POLICY "Org admin_tecnico manage rotas"
  ON public.rotas FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

DROP POLICY IF EXISTS "Admin and tecnico can view rotas" ON public.rotas;
CREATE POLICY "Org members view rotas"
  ON public.rotas FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- 11. user_permissions (A9) ------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
CREATE POLICY "Org admins manage permissions"
  ON public.user_permissions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid())
  );

-- 12. empresa_config (C2) ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view empresa_config" ON public.empresa_config;
CREATE POLICY "Org members view empresa_config"
  ON public.empresa_config FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage empresa_config" ON public.empresa_config;
CREATE POLICY "Org admins manage empresa_config"
  ON public.empresa_config FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- 13. RPCs count_* (C9): revogar execucao publica + validar org do chamador --------
REVOKE EXECUTE ON FUNCTION public.count_os_current_month(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_active_users(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.count_os_current_month(_org uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _org IS DISTINCT FROM public.get_user_org_id(auth.uid()) THEN 0
    ELSE (SELECT COUNT(*)::int FROM public.ordens_servico
          WHERE organization_id = _org AND created_at >= date_trunc('month', now()))
  END
$$;

CREATE OR REPLACE FUNCTION public.count_active_users(_org uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _org IS DISTINCT FROM public.get_user_org_id(auth.uid()) THEN 0
    ELSE (SELECT COUNT(*)::int FROM public.profiles WHERE organization_id = _org)
  END
$$;

GRANT EXECUTE ON FUNCTION public.count_os_current_month(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_users(uuid) TO authenticated;
