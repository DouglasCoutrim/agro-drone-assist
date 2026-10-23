ALTER TABLE public.nfe_config
  ADD COLUMN IF NOT EXISTS nfse_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_item_lista_servico text,
  ADD COLUMN IF NOT EXISTS nfse_codigo_tributario_municipio text,
  ADD COLUMN IF NOT EXISTS nfse_codigo_cnae text,
  ADD COLUMN IF NOT EXISTS nfse_aliquota numeric(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_iss_retido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_natureza_operacao text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS nfse_discriminacao_padrao text;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS nfse_numero text;