
-- Tabela de produtos (catálogo)
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT,
  descricao TEXT NOT NULL,
  categoria TEXT DEFAULT 'geral',
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  preco_venda NUMERIC NOT NULL DEFAULT 0,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can manage produtos"
  ON public.produtos FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Org users can view produtos"
  ON public.produtos FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de serviços (catálogo)
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  tempo_estimado TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can manage servicos"
  ON public.servicos FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Org users can view servicos"
  ON public.servicos FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_servicos_updated_at
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de itens da OS (vincula produtos/serviços à OS)
CREATE TABLE public.itens_os (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'produto', -- 'produto' ou 'servico'
  produto_id UUID REFERENCES public.produtos(id),
  servico_id UUID REFERENCES public.servicos(id),
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.itens_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can manage itens_os"
  ON public.itens_os FOR ALL TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = get_user_org_id(auth.uid()) AND is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Org users can view itens_os"
  ON public.itens_os FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));
