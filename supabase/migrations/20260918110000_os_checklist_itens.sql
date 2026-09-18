-- =============================================================================
-- ETAPA 2 — Respostas do checklist configurável por OS
-- Tabela auxiliar NOVA: registra o estado de cada item de checklist (marcado)
-- vinculado a uma OS. Nenhum campo de ordens_servico é alterado.
-- RLS org-scoped: membros leem; admin/tecnico escrevem (o técnico preenche a OS).
-- Idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.os_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.checklist_equipamento_itens(id) ON DELETE CASCADE,
  marcado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS os_checklist_itens_os_item_uniq
  ON public.os_checklist_itens(ordem_servico_id, item_id);
CREATE INDEX IF NOT EXISTS idx_os_checklist_itens_os
  ON public.os_checklist_itens(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_checklist_itens_org
  ON public.os_checklist_itens(organization_id);

ALTER TABLE public.os_checklist_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view os_checklist_itens" ON public.os_checklist_itens;
CREATE POLICY "Org members view os_checklist_itens"
  ON public.os_checklist_itens FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Org admin_tecnico manage os_checklist_itens" ON public.os_checklist_itens;
CREATE POLICY "Org admin_tecnico manage os_checklist_itens"
  ON public.os_checklist_itens FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));

DROP TRIGGER IF EXISTS trg_os_checklist_itens_updated ON public.os_checklist_itens;
CREATE TRIGGER trg_os_checklist_itens_updated
  BEFORE UPDATE ON public.os_checklist_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();