-- =============================================================================
-- STORAGE BUCKET POLICY ORG-SCOPED (Prompt 2.5)
-- Corrigir policy do bucket os-anexos para escopar por organization_id.
-- =============================================================================

-- Remover policy role-only e adicionar policy com escopo de org
DROP POLICY IF EXISTS "Authenticated users can view os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Admin and tecnico can upload os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Admin and tecnico can update os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete os-anexos" ON storage.objects;

-- Policy para visualização: membros da org podem ver anexos da própria org
CREATE POLICY "Org members view os-anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'os-anexos'
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = storage.objects.object_id::uuid
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

-- Policy para upload: admin/técnico da org podem enviar
CREATE POLICY "Org admin_tecnico upload os-anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'os-anexos'
    AND public.is_admin_or_tecnico(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = storage.objects.object_id::uuid
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

-- Policy para atualização: admin/técnico da org podem atualizar
CREATE POLICY "Org admin_tecnico update os-anexos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'os-anexos'
    AND public.is_admin_or_tecnico(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = storage.objects.object_id::uuid
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'os-anexos'
    AND public.is_admin_or_tecnico(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = storage.objects.object_id::uuid
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );

-- Policy para exclusão: apenas admin da org pode deletar
CREATE POLICY "Org admin delete os-anexos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'os-anexos'
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.ordens_servico os
      WHERE os.id = storage.objects.object_id::uuid
      AND os.organization_id = public.get_user_org_id(auth.uid())
    )
  );
