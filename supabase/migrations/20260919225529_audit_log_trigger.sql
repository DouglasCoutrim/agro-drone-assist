-- =============================================================================
-- ADMIN_AUDIT_LOG TRIGGER (Prompt 1.7 - C7)
-- Trigger para log automático de auditoria quando tenant é bloqueado.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_tenant_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'blocked' AND OLD.status != 'blocked' THEN
    INSERT INTO public.admin_audit_log (action, organization_id, target_id, details)
    VALUES (
      'tenant_blocked',
      NEW.id,
      NEW.id,
      jsonb_build_object(
        'reason', NEW.blocked_reason,
        'previous_status', OLD.status,
        'action', 'auto_block'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_tenant_block
  AFTER UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tenant_block();
