-- Campos fiscais no estoque
ALTER TABLE public.itens_estoque
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop text NOT NULL DEFAULT '5102',
  ADD COLUMN IF NOT EXISTS origem smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS csosn text NOT NULL DEFAULT '102',
  ADD COLUMN IF NOT EXISTS cst_icms text,
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS gtin text;

-- Campos do destinatário
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS codigo_municipio text,
  ADD COLUMN IF NOT EXISTS indicador_ie smallint NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text;

-- Configuração do emitente
CREATE TABLE public.nfe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  habilitado boolean NOT NULL DEFAULT false,
  ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
  focus_token_homologacao text,
  focus_token_producao text,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  inscricao_estadual text,
  inscricao_municipal text,
  regime_tributario smallint NOT NULL DEFAULT 1 CHECK (regime_tributario IN (1,2,3)),
  logradouro text, numero text, complemento text, bairro text,
  municipio text, codigo_municipio text, uf text, cep text, telefone text,
  serie integer NOT NULL DEFAULT 1,
  proximo_numero integer NOT NULL DEFAULT 1,
  natureza_operacao text NOT NULL DEFAULT 'Venda de mercadoria',
  informacoes_complementares text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.nfe_config TO authenticated;
GRANT ALL ON public.nfe_config TO service_role;
ALTER TABLE public.nfe_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin da org gerencia config NF-e" ON public.nfe_config FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_nfe_config_updated BEFORE UPDATE ON public.nfe_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reserva atômica de numeração (somente servidor)
CREATE OR REPLACE FUNCTION public.reservar_numero_nfe(_org uuid)
RETURNS TABLE(serie integer, numero integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.nfe_config c SET proximo_numero = c.proximo_numero + 1
  WHERE c.organization_id = _org
  RETURNING c.serie, c.proximo_numero - 1;
END $$;
REVOKE ALL ON FUNCTION public.reservar_numero_nfe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_numero_nfe(uuid) TO service_role;

-- Vendas
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  numero text NOT NULL,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id uuid,
  cliente_nome text NOT NULL,
  cliente_cpf_cnpj text,
  cliente_email text,
  valor_produtos numeric NOT NULL DEFAULT 0,
  valor_desconto numeric NOT NULL DEFAULT 0,
  valor_impostos numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  status_pagamento text NOT NULL DEFAULT 'pendente',
  obs text,
  nf_numero text, nf_chave text, nf_emitida_em timestamptz, nf_provider text,
  vendido_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL,
  UNIQUE (organization_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT ALL ON public.vendas TO service_role;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe vê vendas da org" ON public.vendas FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Equipe cria vendas" ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));
CREATE POLICY "Equipe edita vendas" ON public.vendas FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Admin exclui vendas" ON public.vendas FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));

CREATE TABLE public.venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.itens_estoque(id) ON DELETE SET NULL,
  nome_produto text NOT NULL,
  ncm text, cfop text,
  quantidade numeric NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  desconto_percentual numeric NOT NULL DEFAULT 0,
  desconto_valor numeric NOT NULL DEFAULT 0,
  icms_percentual numeric, icms_valor numeric, pis_cofins_valor numeric, ipi_valor numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_itens TO authenticated;
GRANT ALL ON public.venda_itens TO service_role;
ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itens seguem a venda" ON public.venda_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.organization_id = public.get_user_org_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid())));

-- Notas fiscais (gravadas apenas pelo servidor)
CREATE TABLE public.nota_fiscal_emitida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'nfe',
  ambiente text NOT NULL DEFAULT 'homologacao',
  referencia text NOT NULL UNIQUE,
  numero text, serie text, chave_acesso text, protocolo text,
  xml_url text, pdf_url text, xml_conteudo text,
  cliente_id uuid, cliente_nome text, cliente_cpf_cnpj text, cliente_email text,
  valor_total numeric, valor_impostos numeric, valor_liquido numeric,
  status text NOT NULL DEFAULT 'processando',
  motivo_rejeicao text,
  os_id uuid, venda_id uuid REFERENCES public.vendas(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'focusnfe', provider_id text,
  payload_envio jsonb, payload_retorno jsonb,
  emitida_por uuid, emitida_em timestamptz NOT NULL DEFAULT now(),
  cancelada_em timestamptz, cancelada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfe_org ON public.nota_fiscal_emitida(organization_id);
CREATE INDEX idx_nfe_venda ON public.nota_fiscal_emitida(venda_id);
GRANT SELECT ON public.nota_fiscal_emitida TO authenticated;
GRANT ALL ON public.nota_fiscal_emitida TO service_role;
ALTER TABLE public.nota_fiscal_emitida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe vê notas da org" ON public.nota_fiscal_emitida FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE TRIGGER trg_nfe_updated BEFORE UPDATE ON public.nota_fiscal_emitida FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nota_fiscal_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_id uuid NOT NULL REFERENCES public.nota_fiscal_emitida(id) ON DELETE CASCADE,
  descricao text NOT NULL, quantidade numeric NOT NULL, valor_unitario numeric NOT NULL, valor_total numeric NOT NULL,
  ncm text, cfop text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nota_fiscal_itens TO authenticated;
GRANT ALL ON public.nota_fiscal_itens TO service_role;
ALTER TABLE public.nota_fiscal_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itens de NF da org" ON public.nota_fiscal_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nota_fiscal_emitida n WHERE n.id = nf_id AND n.organization_id = public.get_user_org_id(auth.uid())));

CREATE TABLE public.nota_fiscal_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_id uuid NOT NULL REFERENCES public.nota_fiscal_emitida(id) ON DELETE CASCADE,
  tipo_evento text, descricao text, dados_evento jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nota_fiscal_eventos TO authenticated;
GRANT ALL ON public.nota_fiscal_eventos TO service_role;
ALTER TABLE public.nota_fiscal_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eventos de NF da org" ON public.nota_fiscal_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.nota_fiscal_emitida n WHERE n.id = nf_id AND n.organization_id = public.get_user_org_id(auth.uid())));