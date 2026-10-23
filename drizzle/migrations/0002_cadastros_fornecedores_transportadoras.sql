CREATE TABLE public.fornecedores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), nome text NOT NULL, nome_fantasia text NOT NULL DEFAULT '', cpf_cnpj text NOT NULL DEFAULT '', inscricao_estadual text NOT NULL DEFAULT '', contato text NOT NULL DEFAULT '', telefone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', cep text NOT NULL DEFAULT '', endereco text NOT NULL DEFAULT '', numero text NOT NULL DEFAULT '', complemento text NOT NULL DEFAULT '', bairro text NOT NULL DEFAULT '', cidade text NOT NULL DEFAULT '', estado text NOT NULL DEFAULT '', observacoes text NOT NULL DEFAULT '', ativo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY fornecedores_leitura ON public.fornecedores FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY fornecedores_criacao ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));
CREATE POLICY fornecedores_edicao ON public.fornecedores FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));
CREATE POLICY fornecedores_exclusao ON public.fornecedores FOR DELETE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE INDEX fornecedores_org_nome ON public.fornecedores(organization_id,nome,id);
CREATE TABLE public.transportadoras (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), nome text NOT NULL, nome_fantasia text NOT NULL DEFAULT '', cpf_cnpj text NOT NULL DEFAULT '', inscricao_estadual text NOT NULL DEFAULT '', contato text NOT NULL DEFAULT '', telefone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', cep text NOT NULL DEFAULT '', endereco text NOT NULL DEFAULT '', numero text NOT NULL DEFAULT '', complemento text NOT NULL DEFAULT '', bairro text NOT NULL DEFAULT '', cidade text NOT NULL DEFAULT '', estado text NOT NULL DEFAULT '', observacoes text NOT NULL DEFAULT '', rntrc text NOT NULL DEFAULT '', ativo boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transportadoras TO authenticated;
GRANT ALL ON public.transportadoras TO service_role;
ALTER TABLE public.transportadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY transportadoras_leitura ON public.transportadoras FOR SELECT TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY transportadoras_criacao ON public.transportadoras FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));
CREATE POLICY transportadoras_edicao ON public.transportadoras FOR UPDATE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid())) WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()));
CREATE POLICY transportadoras_exclusao ON public.transportadoras FOR DELETE TO authenticated USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));
CREATE INDEX transportadoras_org_nome ON public.transportadoras(organization_id,nome,id);