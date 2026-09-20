-- =============================================================================
-- ESTOQUE INDIVIDUAL POR TÉCNICO (Prompt 4.1)
-- Tabelas: estoque_tecnico, transferencias_estoque, patrimonio_ferramentas,
--          patrimonio_movimentacoes
-- =============================================================================

-- 1. Estoque do técnico
CREATE TABLE IF NOT EXISTS public.estoque_tecnico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  tecnico_id UUID NOT NULL REFERENCES auth.users(id),
  item_estoque_id UUID NOT NULL REFERENCES public.itens_estoque(id),
  quantidade INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, tecnico_id, item_estoque_id)
);

ALTER TABLE public.estoque_tecnico ENABLE ROW LEVEL SECURITY;

-- Técnico vê/altera o próprio; admin vê todos da org
CREATE POLICY "Org members view estoque tecnico"
  ON public.estoque_tecnico FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND (
      tecnico_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Tecnico update own estoque"
  ON public.estoque_tecnico FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND tecnico_id = auth.uid()
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND tecnico_id = auth.uid()
  );

CREATE POLICY "Admin manage all estoque tecnico"
  ON public.estoque_tecnico FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. Transferências de estoque
CREATE TABLE IF NOT EXISTS public.transferencias_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  item_estoque_id UUID NOT NULL REFERENCES public.itens_estoque(id),
  quantidade INTEGER NOT NULL,
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('central', 'tecnico')),
  origem_id UUID NOT NULL,
  destino_tipo text NOT NULL CHECK (destino_tipo IN ('central', 'tecnico')),
  destino_id UUID NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada')),
  solicitado_por UUID REFERENCES auth.users(id),
  confirmado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

ALTER TABLE public.transferencias_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view transferencias"
  ON public.transferencias_estoque FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admin insert transferencias"
  ON public.transferencias_estoque FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.is_admin_or_tecnico(auth.uid())
  );

-- Trigger para confirmar transferência e atualizar saldos
CREATE OR REPLACE FUNCTION public.confirmar_transferencia_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_origem INTEGER;
  v_saldo_destino INTEGER;
BEGIN
  IF NEW.status = 'confirmada' AND OLD.status != 'confirmada' THEN
    -- Decrementar origem
    IF NEW.origem_tipo = 'central' THEN
      UPDATE public.itens_estoque SET quantidade = quantidade - NEW.quantidade
      WHERE id = NEW.origem_id;
    ELSE
      UPDATE public.estoque_tecnico SET quantidade = quantidade - NEW.quantidade
      WHERE item_estoque_id = NEW.origem_id AND tecnico_id = NEW.origem_id;
    END IF;

    -- Incrementar destino
    IF NEW.destino_tipo = 'central' THEN
      UPDATE public.itens_estoque SET quantidade = quantidade + NEW.quantidade
      WHERE id = NEW.destino_id;
    ELSE
      UPDATE public.estoque_tecnico SET quantidade = quantidade + NEW.quantidade
      WHERE item_estoque_id = NEW.destino_id AND tecnico_id = NEW.destino_id;
    END IF;

    -- Registrar movimentação
    INSERT INTO public.movimentacoes_estoque (item_id, ordem_servico_id, tipo, quantidade, motivo, usuario_id)
    VALUES (NEW.item_estoque_id, NULL, 'transferencia_tecnico', NEW.quantidade,
      'Transferência de estoque #' || NEW.id, NEW.confirmado_por);

    NEW.confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_confirmar_transferencia
  AFTER UPDATE ON public.transferencias_estoque
  FOR EACH ROW
  EXECUTE FUNCTION public.confirmar_transferencia_estoque();

-- 3. Patrimônio de ferramentas
CREATE TABLE IF NOT EXISTS public.patrimonio_ferramentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  nome text NOT NULL,
  numero_serie text,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'extraviada')),
  tecnico_atual_id UUID REFERENCES auth.users(id),
  valor_referencia numeric(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrimonio_ferramentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view patrimonio"
  ON public.patrimonio_ferramentas FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admin manage all patrimonio"
  ON public.patrimonio_ferramentas FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Movimentações de patrimônio
CREATE TABLE IF NOT EXISTS public.patrimonio_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio_id UUID NOT NULL REFERENCES public.patrimonio_ferramentas(id),
  tecnico_anterior_id UUID REFERENCES auth.users(id),
  tecnico_novo_id UUID REFERENCES auth.users(id),
  tipo text NOT NULL CHECK (tipo IN ('entrega', 'devolucao', 'transferencia', 'extravio')),
  observacao text,
  confirmado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrimonio_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view patrimonio movimentacoes"
  ON public.patrimonio_movimentacoes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.patrimonio_ferramentas pf WHERE pf.id = patrimonio_movimentacoes.patrimonio_id AND pf.organization_id = public.get_user_org_id(auth.uid()))
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_estoque_tecnico_org ON public.estoque_tecnico(organization_id);
CREATE INDEX IF NOT EXISTS idx_estoque_tecnico_tecnico ON public.estoque_tecnico(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_org ON public.transferencias_estoque(organization_id);
CREATE INDEX IF NOT EXISTS idx_patrimonio_org ON public.patrimonio_ferramentas(organization_id);
CREATE INDEX IF NOT EXISTS idx_patrimonio_tecnico ON public.patrimonio_ferramentas(tecnico_atual_id);
