-- CRITICAL SECURITY FIX: Enable Row Level Security on all multi-tenant tables.
-- Policies already exist filtering by organization_id, but RLS was disabled,
-- causing data leakage across tenants.

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_os ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Ensure INSERT policies have WITH CHECK constraints scoped to the user's organization.
-- The existing INSERT policies had NULL qual/check (permissive).

DROP POLICY IF EXISTS "Org users can insert clientes" ON public.clientes;
CREATE POLICY "Org users can insert clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

DROP POLICY IF EXISTS "Org users can insert OS" ON public.ordens_servico;
CREATE POLICY "Org users can insert OS" ON public.ordens_servico
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert org profiles" ON public.profiles;
CREATE POLICY "Admins can insert org profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_org_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can insert org user roles" ON public.user_roles;
CREATE POLICY "Admins can insert org user roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.get_user_org_id(user_id) = public.get_user_org_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated can insert organizations" ON public.organizations;
CREATE POLICY "Authenticated can insert organizations" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin(auth.uid()));