-- =============================================================================
-- BASE DE REPRODUTIBILIDADE (C8/C10)
-- Objetos que existem apenas no banco vivo (criados manualmente) e eram a raiz
-- da quebra do `supabase db reset`:
--   * tabela public.organizations
--   * function public.get_user_org_id
--   * colunas organization_id nas tabelas de negocio
--   * coluna owner_id em public.empresa_config
-- Idempotente: seguro em reset limpo E em push para banco existente.
-- Timestamp propositalmente anterior a 20260414183259 (primeira policy que usa
-- get_user_org_id) para o reset reproduzir o schema vivo na ordem correta.
-- =============================================================================

-- 1. Tabela organizations ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  telefone text,
  plan text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'active',
  subscription_status text NOT NULL DEFAULT 'trial',
  active boolean NOT NULL DEFAULT true,
  is_vip boolean NOT NULL DEFAULT false,
  trial_ends_at timestamptz,
  expires_at timestamptz,
  next_due_date timestamptz,
  blocked_at timestamptz,
  blocked_reason text,
  monthly_fee numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 3,
  max_os_per_month integer NOT NULL DEFAULT 100,
  billing_cycle text NOT NULL DEFAULT 'mensal',
  cycle_discount numeric NOT NULL DEFAULT 0,
  plan_id uuid,
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON public.organizations(slug);

-- 2. get_user_org_id ------------------------------------------------------
-- SECURITY DEFINER como has_role/is_admin_or_tecnico (evita recursao de RLS
-- quando usada dentro de policies da propria tabela profiles).
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- 3. organization_id nas tabelas de negocio --------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.itens_estoque
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.os_anexos
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.os_historico
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- Remove rows de empresa_config sem organização (ex: seed do template) para
-- que o SET NOT NULL posterior (20260618121443) funcione em reset limpo.
DELETE FROM public.empresa_config WHERE organization_id IS NULL;

-- 4. Indices para as queries por organização -------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org ON public.clientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_itens_estoque_org ON public.itens_estoque(organization_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_org ON public.ordens_servico(organization_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_org ON public.movimentacoes_estoque(organization_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_org ON public.financeiro(organization_id);
CREATE INDEX IF NOT EXISTS idx_os_anexos_org ON public.os_anexos(organization_id);
CREATE INDEX IF NOT EXISTS idx_os_historico_org ON public.os_historico(organization_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_org ON public.orcamentos(organization_id);
CREATE INDEX IF NOT EXISTS idx_rotas_org ON public.rotas(organization_id);
