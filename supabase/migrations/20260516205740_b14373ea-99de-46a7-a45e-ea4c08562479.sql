
-- 1. Atualizar planos: limpar antigos e inserir Bronze/Prata/Ouro
DELETE FROM public.subscription_plans;

INSERT INTO public.subscription_plans (slug, name, monthly_price, max_users, max_os_per_month, features, active) VALUES
('bronze', 'Bronze', 39.90, 2, 30, '["os","clientes","estoque","orcamentos"]'::jsonb, true),
('prata', 'Prata', 59.90, 4, 60, '["os","clientes","estoque","orcamentos","financeiro","cobrancas_asaas","mercado_livre","whatsapp_templates"]'::jsonb, true),
('ouro', 'Ouro', 69.90, 10, -1, '["os","clientes","estoque","orcamentos","financeiro","cobrancas_asaas","mercado_livre","whatsapp_templates","rotas","whitelabel","api_rest","suporte_prioritario"]'::jsonb, true);

-- 2. Colunas em organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS cycle_discount numeric NOT NULL DEFAULT 0;

-- Migrar planos antigos
UPDATE public.organizations SET plan = 'bronze' WHERE plan IN ('basic','trial');
UPDATE public.organizations SET plan = 'prata' WHERE plan = 'pro';
UPDATE public.organizations SET plan = 'ouro' WHERE plan = 'enterprise';

-- 3. Colunas em empresa_config
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS gateway_clientes text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS gateway_clientes_credentials jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Funções de contagem
CREATE OR REPLACE FUNCTION public.count_os_current_month(_org uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.ordens_servico
  WHERE organization_id = _org
    AND created_at >= date_trunc('month', now())
$$;

CREATE OR REPLACE FUNCTION public.count_active_users(_org uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.profiles WHERE organization_id = _org
$$;
