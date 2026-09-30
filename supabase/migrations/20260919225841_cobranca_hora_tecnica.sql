-- =============================================================================
-- COBRAÇA POR HORA TÉCNICA (Prompt 3.1)
-- Adiciona colunas de cobrança por hora aos serviços, técnicos e empresa_config,
-- e cria a tabela os_apontamentos_horas.
-- =============================================================================

-- 1. Serviços: colunas de tipo de cobrança
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS tipo_cobranca text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS valor_fixo numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_hora numeric(12,2),
  ADD COLUMN IF NOT EXISTS hora_minima numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fracionamento text NOT NULL DEFAULT 'exato';

-- Enum para fracionamento
-- NOTA: o tipo text já suporta os valores 'fixo'|'hora_tecnica' e 'exato'|'15min'|'30min'|'1h'

-- 2. Técnicos: valor hora específico (sobrepõe o do serviço)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS valor_hora_tecnica numeric(12,2);

-- 3. Empresa config: valor hora padrão como fallback
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS valor_hora_padrao numeric(12,2) NOT NULL DEFAULT 0;

-- 4. Tabela de apontamentos de horas
CREATE TABLE IF NOT EXISTS public.os_apontamentos_horas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id),
  item_os_id UUID REFERENCES public.itens_os(id),
  tecnico_id UUID REFERENCES auth.users(id),
  inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim TIMESTAMPTZ,
  horas_lancadas numeric(12,2),
  origem text NOT NULL DEFAULT 'cronometro' CHECK (origem IN ('cronometro', 'manual')),
  observacao text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.os_apontamentos_horas ENABLE ROW LEVEL SECURITY;

-- RLS: Técnico vê/altera seus próprios apontamentos; admin vê todos da org
CREATE POLICY "Org members view apontamentos"
  ON public.os_apontamentos_horas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_apontamentos_horas.os_id
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Org admin_tecnico insert apontamentos"
  ON public.os_apontamentos_horas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_apontamentos_horas.os_id
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Org admin_tecnico update apontamentos"
  ON public.os_apontamentos_horas FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_apontamentos_horas.os_id
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
    AND public.is_admin_or_tecnico(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_apontamentos_horas.os_id
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
    AND public.is_admin_or_tecnico(auth.uid())
  );

CREATE POLICY "Org admin_tecnico delete apontamentos"
  ON public.os_apontamentos_horas FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = os_apontamentos_horas.os_id
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
    AND public.is_admin_or_tecnico(auth.uid())
  );

-- 5. Itens de OS: snapshot do tipo de cobrança e valor efetivo
ALTER TABLE public.itens_os
  ADD COLUMN IF NOT EXISTS snapshot_tipo_cobranca text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS snapshot_valor_hora_efetivo numeric(12,2) DEFAULT 0;

-- Trigger para capturar snapshot ao adicionar item à OS
CREATE OR REPLACE FUNCTION public.snapshot_item_cobranca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico record;
  v_valor_hora_eff numeric(12,2);
BEGIN
  SELECT tipo_cobranca, valor_hora, valor_fixo, hora_minima, fracionamento
  INTO v_servico
  FROM public.servicos WHERE id = NEW.servico_id;

  -- Determinar taxa efetiva: técnico > serviço > empresa
  IF v_servico.tipo_cobranca = 'hora_tecnica' THEN
    SELECT COALESCE(p.valor_hora_tecnica, v_servico.valor_hora, ec.valor_hora_padrao)
    INTO v_valor_hora_eff
    FROM public.profiles p
    CROSS JOIN public.empresa_config ec
    WHERE p.id = NEW.tecnico_id;

    NEW.snapshot_tipo_cobranca := v_servico.tipo_cobranca;
    NEW.snapshot_valor_hora_efetivo := v_valor_hora_eff;
  ELSE
    NEW.snapshot_tipo_cobranca := v_servico.tipo_cobranca;
    NEW.snapshot_valor_hora_efetivo := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_item_cobranca
  BEFORE INSERT ON public.itens_os
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_item_cobranca();

-- Índice para queries de apontamentos
CREATE INDEX IF NOT EXISTS idx_apontamentos_os ON public.os_apontamentos_horas(os_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_tecnico ON public.os_apontamentos_horas(tecnico_id);
