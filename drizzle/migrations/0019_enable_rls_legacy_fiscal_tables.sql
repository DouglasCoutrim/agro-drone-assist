ALTER TABLE public.fiscal_company_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_retention_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fiscal_company_config, public.fiscal_documents, public.technician_expenses, public.os_technicians, public.tax_retention_ledger FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_company_config, public.fiscal_documents, public.technician_expenses, public.os_technicians, public.tax_retention_ledger TO authenticated;
GRANT ALL ON public.fiscal_company_config, public.fiscal_documents, public.technician_expenses, public.os_technicians, public.tax_retention_ledger TO service_role;

DROP POLICY IF EXISTS "Org admins manage fiscal config" ON public.fiscal_company_config;
CREATE POLICY "Org admins manage fiscal config" ON public.fiscal_company_config FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'))
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Org admins manage fiscal documents" ON public.fiscal_documents;
CREATE POLICY "Org admins manage fiscal documents" ON public.fiscal_documents FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'))
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "View own or org admin expenses" ON public.technician_expenses;
CREATE POLICY "View own or org admin expenses" ON public.technician_expenses FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND (technician_id = auth.uid() OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "Org admins manage expenses" ON public.technician_expenses;
CREATE POLICY "Org admins manage expenses" ON public.technician_expenses FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'))
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "View own or org admin os technicians" ON public.os_technicians;
CREATE POLICY "View own or org admin os technicians" ON public.os_technicians FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.id = os_technicians.ordem_servico_id
  AND os.organization_id = public.get_user_org_id(auth.uid()))
  AND (technician_id = auth.uid() OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "Org admins manage os technicians" ON public.os_technicians;
CREATE POLICY "Org admins manage os technicians" ON public.os_technicians FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.id = os_technicians.ordem_servico_id AND os.organization_id = public.get_user_org_id(auth.uid())))
WITH CHECK (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.id = os_technicians.ordem_servico_id AND os.organization_id = public.get_user_org_id(auth.uid())));

DROP POLICY IF EXISTS "View own or org admin retentions" ON public.tax_retention_ledger;
CREATE POLICY "View own or org admin retentions" ON public.tax_retention_ledger FOR SELECT TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND (technician_id = auth.uid() OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "Org admins manage retentions" ON public.tax_retention_ledger;
CREATE POLICY "Org admins manage retentions" ON public.tax_retention_ledger FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'))
WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins insert audit log" ON public.admin_audit_log;
CREATE POLICY "Admins insert audit log" ON public.admin_audit_log FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid())
  OR (organization_id = public.get_user_org_id(auth.uid()) AND public.has_role(auth.uid(),'admin')));