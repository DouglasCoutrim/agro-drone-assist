-- =============================================================================
-- EMPRESA_GATEWAY_CREDENCIAIS (Prompt 1.2 - C2)
-- Tabela separada para credenciais de gateway de pagamento, com RLS restrita
-- a organization_id e role = 'admin'.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.empresa_gateway_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  gateway_tipo TEXT NOT NULL CHECK (gateway_tipo IN ('asaas', 'mercadopago', 'pix_manual')),
  chave_json JSONB NOT NULL DEFAULT '{}',
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, gateway_tipo)
);

ALTER TABLE public.empresa_gateway_credenciais ENABLE ROW LEVEL SECURITY;

-- RLS: Apenas admins da mesma organização podem ver/gerenciar
CREATE POLICY "Org admins view gateway credenciais"
  ON public.empresa_gateway_credenciais FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Org admins manage gateway credenciais"
  ON public.empresa_gateway_credenciais FOR ALL TO authenticated
  USING (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    organization_id = public.get_user_org_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Índice para queries por organização
CREATE INDEX IF NOT EXISTS idx_empresa_gw_cred_org ON public.empresa_gateway_credenciais(organization_id);

-- =============================================================================
-- ADMIN_AUDIT_LOG (Prompt 1.7 - C7)
-- Log de auditoria para ações administrativas como bloqueio de tenants.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  performed_by UUID REFERENCES auth.users(id),
  target_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: admins podem ver logs da própria org; platform admins veem tudo
CREATE POLICY "Admins view audit log own org"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (
    (organization_id = public.get_user_org_id(auth.uid()) AND public.is_admin_or_tecnico(auth.uid()))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins insert audit log"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_empresa_gateway_credenciais_updated_at
  BEFORE UPDATE ON public.empresa_gateway_credenciais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
