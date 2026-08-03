-- =============================================================================
-- SEGMENTOS DE ATUAÇÃO - PERMITE ATUALIZAR organizations.settings
-- A tela "Segmentos de Atuação" (e o dropdown de tipos da OS) salva os nichos
-- e tipos customizados em organizations.settings (jsonb) via `supabase
-- .from('organizations').update(...)`. A policy de org-scope só liberava SELECT
-- ("Org members view own org"), então o UPDATE era bloqueado por RLS e os
-- segmentos nunca persistiam (o dropdown caía no fallback "todos os nichos").
-- Esta policy libera UPDATE para membros admin/tecnico da PRÓPRIA org.
-- Idempotente.
-- =============================================================================

DROP POLICY IF EXISTS "Org admin_tecnico update own org" ON public.organizations;
CREATE POLICY "Org admin_tecnico update own org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    id = public.get_user_org_id(auth.uid())
    AND public.is_admin_or_tecnico(auth.uid())
  )
  WITH CHECK (
    id = public.get_user_org_id(auth.uid())
    AND public.is_admin_or_tecnico(auth.uid())
  );
