-- =============================================================================
-- CHECKLIST DE REVISÃO POR TIPO DE EQUIPAMENTO (Etapa 1)
-- Tipos de equipamento configuráveis + itens de verificação (obrigatório/opcional).
-- Tabelas auxiliares NOVAS: nenhum campo de ordens_servico é alterado.
-- RLS org-scoped: qualquer membro lê (o técnico preenche a OS depois);
-- escrita somente admin da organização.
-- Idempotente.
-- =============================================================================

-- 1. Tipos de equipamento configuráveis --------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_tipos_equipamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,                              -- nome exibido (ex: "Drone de Pulverização")
  value text NOT NULL,                              -- slug estável consumido pelo formulário de OS
  descricao text,                                   -- opcional
  db_enum text NOT NULL DEFAULT 'outro'
    CHECK (db_enum IN ('drone_agricola', 'drone_convencional', 'controle', 'bateria', 'outro')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS checklist_tipos_equip_org_value_uniq
  ON public.checklist_tipos_equipamento(organization_id, value);
CREATE INDEX IF NOT EXISTS idx_checklist_tipos_equip_org
  ON public.checklist_tipos_equipamento(organization_id);

-- 2. Itens de checklist por tipo ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.checklist_equipamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo_equipamento_id uuid NOT NULL
    REFERENCES public.checklist_tipos_equipamento(id) ON DELETE CASCADE,
  label text NOT NULL,                              -- ex: "Verificar hélices e fixações"
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_equip_itens_tipo
  ON public.checklist_equipamento_itens(tipo_equipamento_id);
CREATE INDEX IF NOT EXISTS idx_checklist_equip_itens_org
  ON public.checklist_equipamento_itens(organization_id);

-- 3. RLS ----------------------------------------------------------------------
ALTER TABLE public.checklist_tipos_equipamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_equipamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view checklist tipos" ON public.checklist_tipos_equipamento;
CREATE POLICY "Org members view checklist tipos"
  ON public.checklist_tipos_equipamento FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Org members view checklist itens" ON public.checklist_equipamento_itens;
CREATE POLICY "Org members view checklist itens"
  ON public.checklist_equipamento_itens FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Org admins manage checklist tipos" ON public.checklist_tipos_equipamento;
CREATE POLICY "Org admins manage checklist tipos"
  ON public.checklist_tipos_equipamento FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Org admins manage checklist itens" ON public.checklist_equipamento_itens;
CREATE POLICY "Org admins manage checklist itens"
  ON public.checklist_equipamento_itens FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Triggers de updated_at ---------------------------------------------------
DROP TRIGGER IF EXISTS trg_checklist_tipos_updated ON public.checklist_tipos_equipamento;
CREATE TRIGGER trg_checklist_tipos_updated
  BEFORE UPDATE ON public.checklist_tipos_equipamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_checklist_itens_updated ON public.checklist_equipamento_itens;
CREATE TRIGGER trg_checklist_itens_updated
  BEFORE UPDATE ON public.checklist_equipamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();