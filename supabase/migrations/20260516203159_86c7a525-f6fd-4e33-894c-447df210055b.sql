
-- 1. platform_admins
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;

CREATE POLICY "Platform admins view admins" ON public.platform_admins
FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage admins" ON public.platform_admins
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 2. subscription_plans
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  monthly_price numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 3,
  max_os_per_month integer NOT NULL DEFAULT 100,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active plans" ON public.subscription_plans
FOR SELECT TO authenticated USING (active = true OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage plans" ON public.subscription_plans
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscription_plans (name, slug, monthly_price, max_users, max_os_per_month, features) VALUES
('Basic', 'basic', 99, 3, 100, '["OS","Estoque","Clientes"]'::jsonb),
('Pro', 'pro', 199, 10, 500, '["OS","Estoque","Clientes","Financeiro","Orçamentos","Rotas"]'::jsonb),
('Enterprise', 'enterprise', 399, 50, 5000, '["Tudo","Whitelabel","API","Suporte Prioritário"]'::jsonb);

-- 3. organizations - extensões
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS next_due_date date,
  ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS max_users integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_os_per_month integer NOT NULL DEFAULT 100;

-- Platform admin policies on organizations
CREATE POLICY "Platform admins view all orgs" ON public.organizations
FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage all orgs" ON public.organizations
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

-- 4. tenant_invoices
CREATE TABLE public.tenant_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  competencia text NOT NULL,
  valor numeric NOT NULL,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  asaas_charge_id text,
  payment_url text,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tenant_invoices_org ON public.tenant_invoices(organization_id);
CREATE INDEX idx_tenant_invoices_status ON public.tenant_invoices(status);

CREATE POLICY "Platform admins manage invoices" ON public.tenant_invoices
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Org members can view own invoices" ON public.tenant_invoices
FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.tenant_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. empresa_config - whitelabel
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS cor_primaria text DEFAULT '#39FF14',
  ADD COLUMN IF NOT EXISTS cor_secundaria text DEFAULT '#0A0A0A',
  ADD COLUMN IF NOT EXISTS favicon_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS dominio_personalizado text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_remetente text DEFAULT '',
  ADD COLUMN IF NOT EXISTS gateway_pagamento text DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS gateway_credentials jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subdominio text;
