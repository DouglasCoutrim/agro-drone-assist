-- Remove executable SECURITY DEFINER functions from the exposed API surface.
-- Trigger-only helpers keep definer semantics but cannot be invoked directly.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.atualizar_status_contas_pagar() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.confirmar_transferencia_estoque() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_permissions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_tenant_block() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_commission() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_itens_os_org() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_storage_owner() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_item_cobranca() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_estoque_baixo() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_os_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_support_reply() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_tenant_invoice() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, uuid, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_org_role(uuid, public.app_role, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_org_all(uuid, text, text, text, text) FROM authenticated;

-- User-callable functions now run with caller permissions, so table RLS remains authoritative.
ALTER FUNCTION public.calculate_os_commission(uuid) SECURITY INVOKER;
ALTER FUNCTION public.count_active_users(uuid) SECURITY INVOKER;
ALTER FUNCTION public.count_os_current_month(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_dre_simplificada(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.get_fluxo_caixa_projetado(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.get_technician_dashboard(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_user_org_id(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_user_role(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_workshop_board() SECURITY INVOKER;
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.is_admin_or_tecnico(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_platform_admin(uuid) SECURITY INVOKER;
ALTER FUNCTION public.notify_broadcast_global(text, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.notify_broadcast_org(uuid, text, text, text, text) SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.calculate_os_commission(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_active_users(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_os_current_month(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dre_simplificada(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_fluxo_caixa_projetado(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_technician_dashboard(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workshop_board() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_tecnico(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_broadcast_global(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_broadcast_org(uuid, text, text, text, text) TO authenticated, service_role;

-- Trigger function with previously mutable search path.
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- Ensure invoker helpers can safely read only the caller's own membership rows.
DROP POLICY IF EXISTS "Users can verify own platform admin membership" ON public.platform_admins;
CREATE POLICY "Users can verify own platform admin membership"
ON public.platform_admins FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Tenant-isolated policies for the private OS attachment bucket.
DROP POLICY IF EXISTS "Org admin_tecnico can view os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Org admin_tecnico upload os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Org admin delete os-anexos" ON storage.objects;

CREATE POLICY "Org admin_tecnico can view os-anexos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'os-anexos'
  AND public.is_admin_or_tecnico(auth.uid())
  AND (
    (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id::text = (storage.foldername(name))[1]
        AND os.organization_id = public.get_user_org_id(auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.os_anexos a
      WHERE a.organization_id = public.get_user_org_id(auth.uid())
        AND (a.url = name OR a.url LIKE ('%' || name))
    )
  )
);

CREATE POLICY "Org admin_tecnico upload os-anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'os-anexos'
  AND public.is_admin_or_tecnico(auth.uid())
  AND (
    (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id::text = (storage.foldername(name))[1]
        AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  )
);

CREATE POLICY "Org admin delete os-anexos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'os-anexos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (
    (storage.foldername(name))[1] = public.get_user_org_id(auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id::text = (storage.foldername(name))[1]
        AND os.organization_id = public.get_user_org_id(auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.os_anexos a
      WHERE a.organization_id = public.get_user_org_id(auth.uid())
        AND (a.url = name OR a.url LIKE ('%' || name))
    )
  )
);

-- Only admins and technicians in the OS tenant may create time entries.
DROP POLICY IF EXISTS "Org admin_tecnico insert apontamentos" ON public.os_apontamentos_horas;
CREATE POLICY "Org admin_tecnico insert apontamentos"
ON public.os_apontamentos_horas FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_tecnico(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_apontamentos_horas.os_id
      AND os.organization_id = public.get_user_org_id(auth.uid())
  )
);