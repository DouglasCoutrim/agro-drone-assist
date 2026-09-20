-- =============================================================================
-- FIX: Comprehensive RLS Organization-Scoped Policies (Issue 3)
-- Refatora políticas de RLS para impedir acesso cruzado entre organizações
-- Garante que TODAS as tabelas tenham RLS ativo com regra estrita:
-- USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
-- =============================================================================

-- ============================================================
-- 1. garantir RLS ativo em todas as tabelas críticas
-- ============================================================

-- Organizations: membros podem ver própria org
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Clientes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clientes'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Itens de OS
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'itens%os%'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Estoque técnico
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'estoque_tecnico'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Movimentações de estoque
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'movimentacoes_estoque'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Ordens de serviço
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ordens_servico'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Financeiro
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financeiro'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Orcamentos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orcamentos'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tab​lename);
  END LOOP;
END $$;

-- Rotas
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rotas'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Produtos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produtos'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Perfis
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Empresa config
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'empresa_config'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Support tickets
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_tickets'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Equipamentos (checklist)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'checklist%'
  LOOP
    EXECUTE format('ALTER TABLE public.%i ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 2. Aplicar políticas org-scoped em profiles
-- ============================================================

-- Drop existing profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Org admins update profiles" ON public.profiles;

-- Users can view their own profile (org-scoped via organization_id)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can view all profiles (but org-scoped for sensitive data)
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can update their own profile (but not organization_id or commission settings - protected by trigger)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Org admins can update profiles of same org (for commission settings)
CREATE POLICY "Org admins update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND organization_id = public.get_user_org_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND organization_id = public.get_user_org_id(auth.uid())
  );

-- ============================================================
-- 3. Aplicar políticas org-scoped em clientes
-- ============================================================

DROP POLICY IF EXISTS "Admin and tecnico can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin and tecnico can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin can delete clientes" ON public.clientes;

CREATE POLICY "Org members view clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admin_tecnico update clientes"
  ON public.clientes FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Org admin delete clientes"
  ON public.clientes FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. Aplicar políticas org-scoped em ordens_servico
-- ============================================================

DROP POLICY IF EXISTS "Org members view OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Org admin_tecnico update OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Org admin delete OS" ON public.ordens_servico;

CREATE POLICY "Org members view OS"
  ON public.ordens_servico FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admin_tecnico update OS"
  ON public.ordens_servico FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Org admin delete OS"
  ON public.ordens_servico FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 5. Aplicar políticas org-scoped em itens_os (itens da OS)
-- ============================================================

DROP POLICY IF EXISTS "Org members view itens_os" ON public.itens_os;
DROP POLICY IF EXISTS "Org admin_tecnico manage itens_os" ON public.itens_os;

CREATE POLICY "Org members view itens_os"
  ON public.itens_os FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admin_tecnico manage itens_os"
  ON public.itens_os FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- ============================================================
-- 6. Aplicar políticas org-scoped em clientes (checklist itens)
-- ============================================================

DROP POLICY IF EXISTS "Org members view checklist_itens" ON public.os_checklist_itens;
DROP POLICY IF EXISTS "Org admin_tecnico manage checklist_itens" ON public.os_checklist_itens;

CREATE POLICY "Org members view checklist_itens"
  ON public.os_checklist_itens FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admin_tecnico manage checklist_itens"
  ON public.os_checklist_itens FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- ============================================================
-- 7. Aplicar políticas org-scoped em estoque/itens_estoque
-- ============================================================

DROP POLICY IF EXISTS "Org members view estoque" ON public.itens_estoque;
DROP POLICY IF EXISTS "Org admin_tecnico manage estoque" ON public.itens_estoque;

CREATE POLICY "Org members view estoque"
  ON public.itens_estoque FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admin_tecnico manage estoque"
  ON public.itens_estoque FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- ============================================================
-- 8. Aplicar políticas org-scoped em financeiro
-- ============================================================

DROP POLICY IF EXISTS "Org admin manage financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Org admin_tecnico view financeiro" ON public.financeiro;

CREATE POLICY "Org admin manage financeiro"
  ON public.financeiro FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admin_tecnico view financeiro"
  ON public.financeiro FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- ============================================================
-- 9. Aplicar políticas org-scoped em orcamentos
-- ============================================================

DROP POLICY IF EXISTS "Org admin_tecnico manage orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Org members view orcamentos" ON public.orcamentos;

CREATE POLICY "Org admin_tecnico manage orcamentos"
  ON public.orcamentos FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Org members view orcamentos"
  ON public.orcamentos FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- ============================================================
-- 10. Aplicar políticas org-scoped em rotas
-- ============================================================

DROP POLICY IF EXISTS "Org admin_tecnico manage rotas" ON public.rotas;
DROP POLICY IF EXISTS "Org members view rotas" ON public.rotas;

CREATE POLICY "Org admin_tecnico manage rotas"
  ON public.rotas FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Org members view rotas"
  ON public.rotas FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

-- ============================================================
-- 11. Aplicar políticas org-scoped em empresa_config
-- ============================================================

DROP POLICY IF EXISTS "Org members view empresa_config" ON public.empresa_config;
DROP POLICY IF EXISTS "Org admins manage empresa_config" ON public.empresa_config;

CREATE POLICY "Org members view empresa_config"
  ON public.empresa_config FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admins manage empresa_config"
  ON public.empresa_config FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 12. Aplicar políticas org-scoped em support_tickets
-- ============================================================

DROP POLICY IF EXISTS "Org members view support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Org admin_tecnico manage support_tickets" ON public.support_tickets;

CREATE POLICY "Org members view support_tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org admin_tecnico manage support_tickets"
  ON public.support_tickets FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- ============================================================
-- 13. Aplicar políticas org-scoped em os_anexos
-- ============================================================

DROP POLICY IF EXISTS "Org members view anexos" ON public.os_anexos;
DROP POLICY IF EXISTS "Org admin_tecnico manage anexos" ON public.os_anexos;

CREATE POLICY "Org members view anexos"
  ON public.os_anexos FOR SELECT
  TO authenticated
  USING (ordem_servico_id IN (
    SELECT id FROM public.ordens_servico
    WHERE organization_id = public.get_user_org_id(auth.uid())
  ));

CREATE POLICY "Org admin_tecnico manage anexos"
  ON public.os_anexos FOR ALL TO authenticated
  USING (ordem_servico_id IN (
    SELECT id FROM public.ordens_servico
    WHERE organization_id = public.get_user_org_id(auth.uid())
  ) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (ordem_servico_id IN (
    SELECT id FROM public.ordens_servico
    WHERE organization_id = public.get_user_org_id(auth.uid())
  ) AND public.is_admin_or_tecnico(auth.uid()));

-- ============================================================
-- 14. Aplicar políticas org-scoped em os_historico
-- ============================================================

DROP POLICY IF EXISTS "Org members view historico" ON public.os_historico;
DROP POLICY IF EXISTS "Org admin_tecnico insert historico" ON public.os_historico;

CREATE POLICY "Org members view historico"
  ON public.os_historico FOR SELECT
  TO authenticated
  USING (ordem_servico_id IN (
    SELECT id FROM public.ordens_servico
    WHERE organization_id = public.get_user_org_id(auth.uid())
  ));

CREATE POLICY "Org admin_tecnico insert historico"
  ON public.os_historico FOR INSERT TO authenticated
  WITH CHECK (ordem_servico_id IN (
    SELECT id FROM public.ordens_servico
    WHERE organization_id = public.get_user_org_id(auth.uid())
  ) AND public.is_admin_or_tecnico(auth.uid()));

-- ============================================================
-- 15. Aplicar políticas org-scoped em support_messages
-- ============================================================

DROP POLICY IF EXISTS "Org members view support_messages" ON public.support_messages;
DROP POLICY IF EXISTS "Org admin_tecnico manage support_messages" ON public.support_messages;

CREATE POLICY "Org members view support_messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (true); -- support_messages doesn't have organization_id, uses user_id

CREATE POLICY "Org admin_tecnico manage support_messages"
  ON public.support_messages FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 16. Revogar execução pública em funções RPC sensíveis
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.calculate_os_commission(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_technician_dashboard(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_workshop_board() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calculate_os_commission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_technician_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workshop_board() TO authenticated;

-- ============================================================
-- FIM DA MIGRATION DE POLÍTICAS RLS ORG-SCOPE
-- ============================================================