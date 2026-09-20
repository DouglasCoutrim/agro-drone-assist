-- =============================================================================
-- DASHBOARD FINANCEIRO + CONTAS A PAGAR (Prompts 5.1-5.2, 6.1-6.2)
-- =============================================================================

-- 5.1 Fluxo de caixa: Tabela contas_pagar
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  descricao text NOT NULL,
  fornecedor_id UUID,
  categoria text NOT NULL,
  valor numeric(12,2) NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado')),
  recorrente boolean NOT NULL DEFAULT false,
  periodicidade text CHECK (periodicidade IN ('mensal', 'semanal', 'anual')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view contas pagar"
  ON public.contas_pagar FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admin insert contas pagar"
  ON public.contas_pagar FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

CREATE POLICY "Admin update contas pagar"
  ON public.contas_pagar FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

-- Trigger para atualizar status de contas a pagar
CREATE OR REPLACE FUNCTION public.atualizar_status_contas_pagar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' THEN
    NEW.data_pagamento = now()::date;
  END IF;
  IF NEW.data_vencimento < now()::date AND NEW.status != 'pago' THEN
    NEW.status = 'atrasado';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_atualizar_status_contas_pagar
  BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_status_contas_pagar();

-- 5.2 DRE simplificado: RPC para demonstrativo de resultado
CREATE OR REPLACE FUNCTION public.get_dre_simplificada(_org uuid, _periodo text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_receita numeric := 0;
  v_comissoes numeric := 0;
  v_custo_pecas numeric := 0;
  v_despesas numeric := 0;
  v_resultado numeric := 0;
  v_periodo_start date;
  v_periodo_end date;
BEGIN
  v_periodo_start := CASE
    WHEN _periodo = 'mes' THEN date_trunc('month', now())::date
    WHEN _periodo = 'trimestre' THEN date_trunc('quarter', now())::date
    WHEN _periodo = 'ano' THEN date_trunc('year', now())::date
    ELSE date_trunc('month', now())::date
  END;
  v_periodo_end := CASE
    WHEN _periodo = 'mes' THEN (v_periodo_start + interval '1 month' - interval '1 day')::date
    WHEN _periodo = 'trimestre' THEN (v_periodo_start + interval '3 month' - interval '1 day')::date
    WHEN _periodo = 'ano' THEN (v_periodo_start + interval '1 year' - interval '1 day')::date
    ELSE (v_periodo_start + interval '1 month' - interval '1 day')::date
  END;

  -- Receita bruta (OS concluídas + vendas)
  SELECT COALESCE(SUM(f.valor), 0) INTO v_receita
  FROM public.financeiro f
  WHERE f.organization_id = _org
    AND f.tipo = 'receita'
    AND f.data_transacao BETWEEN v_periodo_start AND v_periodo_end;

  -- Comissões
  SELECT COALESCE(SUM(os.commission_total), 0) INTO v_comissoes
  FROM public.ordens_servico os
  WHERE os.organization_id = _org
    AND os.status = 'concluida'
    AND os.data_conclusao BETWEEN v_periodo_start AND v_periodo_end;

  -- Custo de peças (saídas de estoque)
  SELECT COALESCE(SUM(me.quantidade * ie.custo_unitario), 0) INTO v_custo_pecas
  FROM public.movimentacoes_estoque me
  JOIN public.itens_estoque ie ON ie.id = me.item_id
  WHERE me.ordem_servico_id IS NOT NULL
    AND me.tipo = 'saida';

  -- Despesas operacionais (contas a pagar pagas)
  SELECT COALESCE(SUM(cp.valor), 0) INTO v_despesas
  FROM public.contas_pagar cp
  WHERE cp.organization_id = _org
    AND cp.status = 'pago'
    AND cp.data_pagamento BETWEEN v_periodo_start AND v_periodo_end;

  v_resultado := v_receita - v_comissoes - v_custo_pecas - v_despesas;

  RETURN json_build_object(
    'receita_bruta', v_receita,
    'comissoes', v_comissoes,
    'custo_pecas', v_custo_pecas,
    'despesas_operacionais', v_despesas,
    'resultado_liquido', v_resultado,
    'periodo_inicio', v_periodo_start,
    'periodo_fim', v_periodo_end
  );
END;
$$;

-- RPC de fluxo de caixa projetado (próximos 30/60/90 dias)
CREATE OR REPLACE FUNCTION public.get_fluxo_caixa_projetado(_org uuid, _dias integer DEFAULT 30)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result json;
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'data', d.data,
        'receber', COALESCE(r.valor, 0),
        'pagar', COALESCE(p.valor, 0),
        'saldo_projetado', COALESCE(r.valor, 0) - COALESCE(p.valor, 0)
      )
    )
    FROM (
      SELECT d::date AS data
      FROM generate_series(now()::date, now()::date + (_dias || ' days')::interval, '1 day'::interval) d
    ) d
    LEFT JOIN (
      SELECT data_vencimento::date AS data, SUM(valor) AS valor
      FROM public.ordens_servico
      WHERE organization_id = _org AND status IN ('concluida', 'entregue') AND valor > 0
      GROUP BY data_vencimento::date
    ) r ON r.data = d.data
    LEFT JOIN (
      SELECT data_vencimento AS data, SUM(valor) AS valor
      FROM public.contas_pagar
      WHERE organization_id = _org AND status = 'pendente'
      GROUP BY data_vencimento
    ) p ON p.data = d.data
    ORDER BY d.data
    LIMIT _dias
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_simplificada(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fluxo_caixa_projetado(uuid, integer) TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS idx_contas_pagar_org ON public.contas_pagar(organization_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON public.contas_pagar(data_vencimento);
