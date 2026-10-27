ALTER TABLE public.patrimonio_ferramentas
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS marca_modelo text,
  ADD COLUMN IF NOT EXISTS data_aquisicao date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS vida_util_meses integer NOT NULL DEFAULT 36,
  ADD COLUMN IF NOT EXISTS valor_residual_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS data_entrega date,
  ADD COLUMN IF NOT EXISTS observacao text;

DROP POLICY IF EXISTS "Org members view patrimonio" ON public.patrimonio_ferramentas;
CREATE POLICY "View own or admin patrimonio" ON public.patrimonio_ferramentas FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND (tecnico_atual_id = auth.uid() OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Org members view patrimonio movimentacoes" ON public.patrimonio_movimentacoes;
CREATE POLICY "View patrimonio movimentacoes" ON public.patrimonio_movimentacoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.patrimonio_ferramentas pf WHERE pf.id = patrimonio_id AND pf.organization_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'admin') OR tecnico_novo_id = auth.uid() OR tecnico_anterior_id = auth.uid())));
CREATE POLICY "Admin insert patrimonio movimentacoes" ON public.patrimonio_movimentacoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.patrimonio_ferramentas pf WHERE pf.id = patrimonio_id AND pf.organization_id = public.get_user_org_id(auth.uid())));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patrimonio_ferramentas TO authenticated;
GRANT SELECT, INSERT ON public.patrimonio_movimentacoes TO authenticated;