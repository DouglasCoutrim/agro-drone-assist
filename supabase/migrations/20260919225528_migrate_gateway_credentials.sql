-- =============================================================================
-- MIGRAÇÃO DE DADOS: empresa_config → empresa_gateway_credenciais (Prompt 1.2)
-- Copia as credenciais de gateway de empresa_config para a nova tabela.
-- Seguro para reaplicar (usa INSERT ... ON CONFLICT).
-- =============================================================================

-- Copia credenciais Asaas
INSERT INTO public.empresa_gateway_credenciais (organization_id, gateway_tipo, chave_json, criado_por, created_at)
SELECT 
  ec.organization_id,
  'asaas'::text,
  jsonb_build_object('api_key', ec.gateway_clientes_credentials->>'api_key', 'asaas_environment', ec.gateway_clientes_credentials->>'asaas_environment'),
  ec.id,
  now()
FROM public.empresa_config ec
WHERE ec.gateway_clientes = 'asaas'
  AND ec.gateway_clientes_credentials->>'api_key' IS NOT NULL
ON CONFLICT (organization_id, gateway_tipo) DO NOTHING;

-- Copia credenciais Mercado Pago
INSERT INTO public.empresa_gateway_credenciais (organization_id, gateway_tipo, chave_json, criado_por, created_at)
SELECT 
  ec.organization_id,
  'mercadopago'::text,
  jsonb_build_object('token', ec.gateway_clientes_credentials->>'token'),
  ec.id,
  now()
FROM public.empresa_config ec
WHERE ec.gateway_clientes = 'mercadopago'
  AND ec.gateway_clientes_credentials->>'token' IS NOT NULL
ON CONFLICT (organization_id, gateway_tipo) DO NOTHING;

-- Copia credenciais PIX Manual
INSERT INTO public.empresa_gateway_credenciais (organization_id, gateway_tipo, chave_json, criado_por, created_at)
SELECT 
  ec.organization_id,
  'pix_manual'::text,
  ec.gateway_clientes_credentials,
  ec.id,
  now()
FROM public.empresa_config ec
WHERE ec.gateway_clientes = 'pix_manual'
ON CONFLICT (organization_id, gateway_tipo) DO NOTHING;

-- Remove a coluna gateway_clientes e gateway_clientes_credentials da empresa_config
-- (após confirmar que os dados foram copiados com sucesso)
ALTER TABLE public.empresa_config
  DROP COLUMN IF EXISTS gateway_clientes,
  DROP COLUMN IF EXISTS gateway_clientes_credentials;
