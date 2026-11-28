-- =====================================================================
-- 0029 — Anexos da OS legíveis por qualquer membro da organização
--
-- Os anexos da OS passaram a ficar no bucket privado `os-anexos`, e a tela
-- assina a leitura na hora (`createSignedUrls`). A policy de SELECT que existia
-- ("Org members view os-anexos") só liberava o caminho do próprio dono do
-- arquivo ou o de quem é `is_admin_or_tecnico(auth.uid())`:
--
--   (owner = auth.uid())
--   OR (is_admin_or_tecnico(auth.uid()) AND <caminho da organização>)
--
-- Consequência: usuário com papel `consulta` não conseguia assinar a URL e
-- via o anexo quebrado, mesmo sendo da mesma organização.
--
-- Esta policy acrescenta uma permissão de leitura para QUALQUER membro da
-- organização dona do arquivo, aceitando as duas convenções de caminho que
-- existem no bucket:
--   * `{organization_id}/{ordem_servico_id}/{arquivo}` — a convenção atual;
--   * `{ordem_servico_id}/{arquivo}` — arquivos antigos;
-- e também o vínculo pelo registro em `public.os_anexos`.
--
-- Policies permissivas são somadas (OR), então nada do que já funcionava deixa
-- de funcionar. A escrita continua restrita a `is_admin_or_tecnico`: as policies
-- de INSERT/UPDATE/DELETE do bucket não foram tocadas.
--
-- Aplicado em produção em 2026-11-22.
-- =====================================================================

CREATE POLICY "Org members veem anexos da organizacao"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'os-anexos'
  AND (
    (storage.foldername(name))[1] = (public.get_user_org_id(auth.uid()))::text
    OR EXISTS (
      SELECT 1
        FROM public.ordens_servico os
       WHERE (os.id)::text = (storage.foldername(name))[1]
         AND os.organization_id = public.get_user_org_id(auth.uid())
    )
    OR EXISTS (
      SELECT 1
        FROM public.os_anexos a
       WHERE a.organization_id = public.get_user_org_id(auth.uid())
         AND (a.url = objects.name OR a.url LIKE '%' || objects.name)
    )
  )
);
