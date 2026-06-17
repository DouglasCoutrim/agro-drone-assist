CREATE POLICY "Platform admins manage all itens_os"
ON public.itens_os
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));