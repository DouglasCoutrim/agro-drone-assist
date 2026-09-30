-- =============================================================================
-- CONSOLIDAÇÃO DE SCRIPTS LOOSOS EM MIGRATIONS FORMais (Prompt 2.5)
-- Converte add-platform-admin.sql, reset-platform-admin.sql, fix-missing-org-id.sql
-- em migrations numeradas e formais.
-- =============================================================================

-- 1. add-platform-admin.sql -> Migration formal
-- O usuário douglascoutrim@livreos.com como administrador da plataforma
-- (Já foi implementado em 20260521170903, esta migration é idempotente)
INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'douglascoutrim@livreos.com'
ON CONFLICT (user_id) DO NOTHING;

-- 2. reset-platform-admin.sql -> Documentado como migration de emergência
-- NOTA: Esta migration é DESTRUTIVA. Use apenas em emergências.
-- O comportamento original já foi substituído por TRUNCATE opt-in em 20260618123536.
-- Esta migration foi preservada para fins de documentação.

-- 3. fix-missing-org-id.sql -> Já coberto por 20260401000000_base_reproducao.sql
-- A coluna organization_id na tabela profiles já foi adicionada e o RLS aplica-se.
-- Não é necessário executar este script separadamente.

-- 4. Remover scripts SQL soltos do repositório
-- (Estes arquivos foram convertidos em migrations acima)
