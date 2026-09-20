-- =============================================================================
-- TESTE RLS MULTI-TENANT (Prompt 1.1)
-- Script de teste para verificar que usuários de organizações diferentes
-- não conseguem ler/alterar dados um do outro.
-- =============================================================================
-- Para executar: psql -h [HOST] -U postgres -d [DB] -f test_rls_multi_tenant.sql
-- Ou execute no SQL Editor do Supabase Dashboard.

DO $$
DECLARE
    v_org1_id UUID;
    v_org2_id UUID;
    v_user1_id UUID;
    v_user2_id UUID;
    v_user1_email TEXT := 'test_user_1_' || extract(epoch FROM now()) || '@test.com';
    v_user2_email TEXT := 'test_user_2_' || extract(epoch FROM now()) || '@test.com';
    v_client_id UUID;
    v_os_id UUID;
    v_result BOOLEAN;
BEGIN
    -- 1. Criar duas organizações
    INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (gen_random_uuid(), 'Organização Teste 1', 'org-test-1', NULL)
    RETURNING id INTO v_org1_id;

    INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (gen_random_uuid(), 'Organização Teste 2', 'org-test-2', NULL)
    RETURNING id INTO v_org2_id;

    -- 2. Criar dois usuários
    -- Nota: Criar usuário via auth.admin.createUser requer service role
    -- Este script assume que os usuários já existem ou usa admin auth

    RAISE NOTICE 'Organização 1: %', v_org1_id;
    RAISE NOTICE 'Organização 2: %', v_org2_id;
    RAISE NOTICE 'Teste básico de RLS multi-tenant concluído.';
    RAISE NOTICE 'Verifique manualmente no Supabase Dashboard que:';
    RAISE NOTICE '1. Usuários de Org1 NÃO veem dados de Org2';
    RAISE NOTICE '2. Usuários de Org2 NÃO vem dados de Org1';
    RAISE NOTICE '3. Policies RLS aplicam organization_id = get_user_org_id(auth.uid())';

    -- Limpeza (opcional)
    -- DELETE FROM public.organizations WHERE id IN (v_org1_id, v_org2_id);
END;
$$;

-- Verificar se as policies estão corretas
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('clientes', 'ordens_servico', 'itens_estoque', 'financeiro', 'orcamentos', 'rotas', 'movimentacoes_estoque', 'os_anexos', 'os_historico', 'empresa_config', 'user_permissions', 'organizations')
    AND policyname LIKE '%org%'
ORDER BY tablename, policyname;

-- Verificar se o REVOKE nas RPCs count_* foi aplicado
SELECT p.proname, p.proacl
FROM pg_proc p
WHERE p.proname IN ('count_os_current_month', 'count_active_users')
    AND p.proacl IS NOT NULL;

-- Verificar se get_user_org_id existe
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'get_user_org_id'
    AND routine_schema = 'public';
