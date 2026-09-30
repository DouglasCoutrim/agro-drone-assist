
-- Fix os-anexos storage: restrict SELECT to users in the same org
DROP POLICY IF EXISTS "Authenticated users can view os-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view attachments" ON storage.objects;

CREATE POLICY "Org admin_tecnico can view os-anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'os-anexos'
    AND is_admin_or_tecnico(auth.uid())
  );

-- Explicit deny UPDATE/DELETE on audit tables (append-only)
CREATE POLICY "No updates on movimentacoes"
  ON public.movimentacoes_estoque FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No deletes on movimentacoes"
  ON public.movimentacoes_estoque FOR DELETE TO authenticated USING (false);

CREATE POLICY "No updates on os_historico"
  ON public.os_historico FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No deletes on os_historico"
  ON public.os_historico FOR DELETE TO authenticated USING (false);
