
-- 1. Create organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Add organization_id to profiles
ALTER TABLE public.profiles ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- 3. Add organization_id to all data tables (nullable for backwards compat)
ALTER TABLE public.clientes ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.ordens_servico ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.itens_estoque ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.financeiro ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.rotas ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.orcamentos ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.movimentacoes_estoque ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.os_historico ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.os_anexos ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.empresa_config ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- 4. Security definer function to get user's org
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- 5. RLS for organizations
CREATE POLICY "Users can view own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = get_user_org_id(auth.uid()));

CREATE POLICY "Authenticated can insert organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- 6. Drop existing RLS policies and recreate with org filter

-- clientes
DROP POLICY IF EXISTS "Admin and tecnico can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin and tecnico can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin and tecnico can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin can delete clientes" ON public.clientes;

CREATE POLICY "Org users can view clientes" ON public.clientes FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can insert clientes" ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can update clientes" ON public.clientes FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org admin can delete clientes" ON public.clientes FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- ordens_servico
DROP POLICY IF EXISTS "Admin and tecnico can insert OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Admin and tecnico can update OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Admin and tecnico can view OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Admin can delete OS" ON public.ordens_servico;

CREATE POLICY "Org users can view OS" ON public.ordens_servico FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can insert OS" ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can update OS" ON public.ordens_servico FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org admin can delete OS" ON public.ordens_servico FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- itens_estoque
DROP POLICY IF EXISTS "Admin and tecnico can manage estoque" ON public.itens_estoque;
DROP POLICY IF EXISTS "Admin and tecnico can view estoque" ON public.itens_estoque;

CREATE POLICY "Org users can view estoque" ON public.itens_estoque FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can manage estoque" ON public.itens_estoque FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

-- financeiro
DROP POLICY IF EXISTS "Admin can manage financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Tecnico can view financeiro" ON public.financeiro;

CREATE POLICY "Org admin can manage financeiro" ON public.financeiro FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Org tecnico can view financeiro" ON public.financeiro FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'tecnico'));

-- rotas
DROP POLICY IF EXISTS "Admin and tecnico can manage rotas" ON public.rotas;
DROP POLICY IF EXISTS "Admin and tecnico can view rotas" ON public.rotas;

CREATE POLICY "Org users can view rotas" ON public.rotas FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can manage rotas" ON public.rotas FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

-- orcamentos
DROP POLICY IF EXISTS "Admin and tecnico can manage orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Admin and tecnico can view orcamentos" ON public.orcamentos;

CREATE POLICY "Org users can view orcamentos" ON public.orcamentos FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can manage orcamentos" ON public.orcamentos FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

-- movimentacoes_estoque
DROP POLICY IF EXISTS "Admin and tecnico can insert movimentacoes" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "Admin and tecnico can view movimentacoes" ON public.movimentacoes_estoque;

CREATE POLICY "Org users can view movimentacoes" ON public.movimentacoes_estoque FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can insert movimentacoes" ON public.movimentacoes_estoque FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

-- os_historico
DROP POLICY IF EXISTS "Admin and tecnico can insert historico" ON public.os_historico;
DROP POLICY IF EXISTS "Admin and tecnico can view historico" ON public.os_historico;

CREATE POLICY "Org users can view historico" ON public.os_historico FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can insert historico" ON public.os_historico FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

-- os_anexos
DROP POLICY IF EXISTS "Admin and tecnico can manage anexos" ON public.os_anexos;
DROP POLICY IF EXISTS "Admin and tecnico can view anexos" ON public.os_anexos;

CREATE POLICY "Org users can view anexos" ON public.os_anexos FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Org users can manage anexos" ON public.os_anexos FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

-- empresa_config
DROP POLICY IF EXISTS "Admins can manage empresa_config" ON public.empresa_config;
DROP POLICY IF EXISTS "Authenticated users can view empresa_config" ON public.empresa_config;

CREATE POLICY "Org admin can manage empresa_config" ON public.empresa_config FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Org users can view empresa_config" ON public.empresa_config FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));
