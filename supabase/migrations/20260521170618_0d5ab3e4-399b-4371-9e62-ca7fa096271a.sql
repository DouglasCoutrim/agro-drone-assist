-- Adicionar políticas para administradores da plataforma (Super Admins) em tabelas principais

-- organizations
CREATE POLICY "Platform admins manage all organizations" ON public.organizations
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- profiles
CREATE POLICY "Platform admins manage all profiles" ON public.profiles
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- ordens_servico
CREATE POLICY "Platform admins manage all ordens_servico" ON public.ordens_servico
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- clientes
CREATE POLICY "Platform admins manage all clientes" ON public.clientes
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- financeiro
CREATE POLICY "Platform admins manage all financeiro" ON public.financeiro
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- itens_estoque
CREATE POLICY "Platform admins manage all itens_estoque" ON public.itens_estoque
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- user_roles
CREATE POLICY "Platform admins manage all user_roles" ON public.user_roles
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- support_tickets
CREATE POLICY "Platform admins manage all support_tickets" ON public.support_tickets
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- support_messages
CREATE POLICY "Platform admins manage all support_messages" ON public.support_messages
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- tenant_invoices
CREATE POLICY "Platform admins manage all tenant_invoices" ON public.tenant_invoices
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- orcamentos
CREATE POLICY "Platform admins manage all orcamentos" ON public.orcamentos
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- subscription_plans
CREATE POLICY "Platform admins manage all subscription_plans" ON public.subscription_plans
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- empresa_config
CREATE POLICY "Platform admins manage all empresa_config" ON public.empresa_config
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- os_anexos
CREATE POLICY "Platform admins manage all os_anexos" ON public.os_anexos
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- os_historico
CREATE POLICY "Platform admins manage all os_historico" ON public.os_historico
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- movimentacoes_estoque
CREATE POLICY "Platform admins manage all movimentacoes_estoque" ON public.movimentacoes_estoque
FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
