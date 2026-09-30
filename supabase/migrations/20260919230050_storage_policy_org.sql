-- =============================================================================
-- STORAGE BUCKET POLICY ORG-SCOPED (Prompt 2.5)
-- Corrigir policy do bucket os-anexos para escopar por organization_id.
-- NOTA: storage.objects usa a coluna 'id' (não 'object_id').
-- O vínculo com organization_id é feito via owner do objeto ou via metadados.
-- =============================================================================

-- Remover policies antigas
DROP POLICY IF EXISTS "Authenticated users can view os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Admin and tecnico can upload os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Admin and tecnico can update os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete os-anexos" ON storage.objects;

-- Policy para visualização: membros da org podem ver anexos da própria org
-- Usa owner do objeto = auth.uid() como filtro primário, combinado com org
CREATE POLICY "Org members view os-anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'os-anexos'
    AND owner = auth.uid()
  );

-- Policy para upload: admin/técnico da org podem enviar
CREATE POLICY "Org admin_tecnico upload os-anexos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'os-anexos'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_admin_or_tecnico(auth.uid())
    )
  );

-- Policy para atualização: admin/técnico da org podem atualizar seus próprios
CREATE POLICY "Org admin_tecnico update os-anexos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'os-anexos'
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'os-anexos'
    AND owner = auth.uid()
  );

-- Policy para exclusão: apenas admin da org pode deletar
CREATE POLICY "Org admin delete os-anexos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'os-anexos'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger para setar owner no upload (garante que o owner seja o usuário autenticado)
CREATE OR REPLACE FUNCTION public.set_storage_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.owner = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_storage_owner
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'os-anexos' AND NEW.owner IS NULL)
  EXECUTE FUNCTION public.set_storage_owner();
