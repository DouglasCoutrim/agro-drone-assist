CREATE TABLE public.cotacoes_compra (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 numero serial,
 fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
 fornecedor_nome text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'aberta',
 observacoes text NOT NULL DEFAULT '',
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotacoes_compra TO authenticated;
GRANT ALL ON public.cotacoes_compra TO service_role;
GRANT USAGE ON SEQUENCE public.cotacoes_compra_numero_seq TO authenticated;
ALTER TABLE public.cotacoes_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY cotacoes_leitura ON public.cotacoes_compra FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY cotacoes_gestao ON public.cotacoes_compra FOR ALL TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin')) WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));

CREATE TABLE public.solicitacoes_compra (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 item_estoque_id uuid REFERENCES public.itens_estoque(id) ON DELETE SET NULL,
 descricao text NOT NULL,
 quantidade numeric NOT NULL DEFAULT 1,
 fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
 fornecedor_nome text NOT NULL DEFAULT '',
 origem text NOT NULL DEFAULT 'tecnico',
 status text NOT NULL DEFAULT 'pendente',
 observacoes text NOT NULL DEFAULT '',
 cotacao_id uuid REFERENCES public.cotacoes_compra(id) ON DELETE SET NULL,
 solicitado_por uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_compra TO authenticated;
GRANT ALL ON public.solicitacoes_compra TO service_role;
ALTER TABLE public.solicitacoes_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY solic_leitura ON public.solicitacoes_compra FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY solic_criacao ON public.solicitacoes_compra FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));
CREATE POLICY solic_edicao ON public.solicitacoes_compra FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin')) WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY solic_exclusao ON public.solicitacoes_compra FOR DELETE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR (solicitado_por = auth.uid() AND status = 'pendente')));
CREATE INDEX solic_org_status ON public.solicitacoes_compra(organization_id, status);

CREATE OR REPLACE FUNCTION public.trg_estoque_baixo_solicitacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.estoque_minimo > 0 AND NEW.quantidade <= NEW.estoque_minimo AND NOT EXISTS (
   SELECT 1 FROM public.solicitacoes_compra s WHERE s.item_estoque_id = NEW.id AND s.status IN ('pendente','em_cotacao')) THEN
   INSERT INTO public.solicitacoes_compra(organization_id,item_estoque_id,descricao,quantidade,fornecedor_nome,origem)
   VALUES (NEW.organization_id, NEW.id, NEW.descricao, GREATEST(NEW.estoque_minimo*2 - NEW.quantidade,1), COALESCE(NEW.fornecedor,''), 'estoque_baixo');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER estoque_baixo_solicitacao AFTER INSERT OR UPDATE OF quantidade, estoque_minimo ON public.itens_estoque
FOR EACH ROW EXECUTE FUNCTION public.trg_estoque_baixo_solicitacao();

INSERT INTO public.solicitacoes_compra(organization_id,item_estoque_id,descricao,quantidade,fornecedor_nome,origem)
SELECT organization_id,id,descricao,GREATEST(estoque_minimo*2-quantidade,1),COALESCE(fornecedor,''),'estoque_baixo'
FROM public.itens_estoque WHERE estoque_minimo > 0 AND quantidade <= estoque_minimo;