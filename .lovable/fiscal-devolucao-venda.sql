-- Área fiscal: suporte à devolução de venda (idempotente e aditivo)

-- 1) Saldo devolvido por item de venda
ALTER TABLE public.venda_itens
  ADD COLUMN IF NOT EXISTS quantidade_devolvida numeric NOT NULL DEFAULT 0;

-- 2) Vínculo da nota com o tipo de operação e a nota de origem
ALTER TABLE public.nota_fiscal_emitida
  ADD COLUMN IF NOT EXISTS tipo_operacao text,
  ADD COLUMN IF NOT EXISTS nota_origem_id uuid REFERENCES public.nota_fiscal_emitida(id);

-- 3) Registro das devoluções de venda
CREATE TABLE IF NOT EXISTS public.devolucoes_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  venda_id uuid NOT NULL REFERENCES public.vendas(id),
  nota_origem_id uuid NOT NULL REFERENCES public.nota_fiscal_emitida(id),
  nf_id uuid REFERENCES public.nota_fiscal_emitida(id),
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor_total numeric NOT NULL DEFAULT 0,
  saldo_baixado boolean NOT NULL DEFAULT false,
  motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devolucoes_venda_org ON public.devolucoes_venda(organization_id);
ALTER TABLE public.devolucoes_venda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devolucoes_venda_select ON public.devolucoes_venda;
CREATE POLICY devolucoes_venda_select ON public.devolucoes_venda FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
GRANT SELECT ON public.devolucoes_venda TO authenticated;
GRANT ALL ON public.devolucoes_venda TO service_role;

-- 4) Regras fiscais de devolução de venda, aguardando validação do contador
INSERT INTO public.fiscal_regras (organization_id, tipo_operacao, cfop, status)
SELECT o.id, 'devolucao_venda_estadual', '1202', 'pendente' FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.fiscal_regras r WHERE r.organization_id = o.id AND r.tipo_operacao = 'devolucao_venda_estadual');
INSERT INTO public.fiscal_regras (organization_id, tipo_operacao, cfop, status)
SELECT o.id, 'devolucao_venda_interestadual', '2202', 'pendente' FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.fiscal_regras r WHERE r.organization_id = o.id AND r.tipo_operacao = 'devolucao_venda_interestadual');

NOTIFY pgrst, 'reload schema';
