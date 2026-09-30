
UPDATE public.subscription_plans SET
  monthly_price = 49.90, max_users = 2, max_os_per_month = 50,
  features = '["os","clientes","estoque"]'::jsonb,
  updated_at = now()
WHERE slug = 'basic';

UPDATE public.subscription_plans SET
  monthly_price = 69.90, max_users = 5, max_os_per_month = 300,
  features = '["os","clientes","estoque","orcamentos","financeiro","cobrancas_asaas","rotas","mercado_livre","whatsapp_templates"]'::jsonb,
  updated_at = now()
WHERE slug = 'pro';

UPDATE public.subscription_plans SET
  monthly_price = 89.90, max_users = 15, max_os_per_month = 999999,
  features = '["os","clientes","estoque","orcamentos","financeiro","cobrancas_asaas","rotas","mercado_livre","whatsapp_templates","whitelabel","api_rest","suporte_prioritario"]'::jsonb,
  updated_at = now()
WHERE slug = 'enterprise';
