-- ============================================================================
-- LivreOS - Hardening: fechar as RPC para o papel `anon`
--
-- CONTEXTO (verificado por leitura antes de escrever este arquivo):
--   - Toda funcao de public carrega o EXECUTE padrao do PUBLIC (o pseudo-papel
--     `=X/postgres` na ACL). Como `anon` herda de PUBLIC, quem tem a chave
--     publicavel (que vai no bundle do site) executa QUALQUER RPC sem login.
--   - Muitas sao SECURITY DEFINER e recebem ids por parametro
--     (ex.: get_technician_dashboard(_tecnico_id), get_technician_os_statement,
--     create_technician_payout_invoice, cancel/settle_technician_payout_invoice,
--     reverter_alteracao, get_org_commissions_report). Sem login, davam para
--     ler/alterar dado de qualquer organizacao.
--   - `authenticated` e `service_role` tem grant DIRETO em toda funcao que hoje
--     aparece via PUBLIC (conferido: nenhuma funcao tem `=X` sem
--     `authenticated=X` e sem `service_role=X`), entao revogar o PUBLIC nao
--     muda nada para eles.
--   - As paginas publicas (/auth, /landing, /cadastro-empresa, /reset-password,
--     /admin/login) so LEEM tabelas (site_config, subscription_plans,
--     platform_admins) — nao chamam nenhuma RPC.
--
-- POR QUE ISSO E SEGURO:
--   - `authenticated` e `service_role` seguem com EXECUTE em tudo (grant direto,
--     que o REVOKE do PUBLIC nao remove). As Edge Functions rodam como
--     service_role.
--   - As funcoes auxiliares usadas DENTRO de policies de RLS sao re-concedidas a
--     `anon`, para uma consulta anonima a profiles/user_roles/site_config (ou ao
--     Storage) continuar retornando vazio em vez de estourar "permission denied".
--     Conjunto usado em policies (conferido em pg_policies):
--       get_user_org_id, has_role, is_admin_or_tecnico, is_platform_admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASSO 1 - Conferir (leitura, registrar antes de mudar)
-- ----------------------------------------------------------------------------
-- select p.proname, pg_get_function_identity_arguments(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prokind = 'f'
--    and has_function_privilege('anon', p.oid, 'EXECUTE')
--  order by p.proname;

-- ----------------------------------------------------------------------------
-- PASSO 2 - Fechar
-- ----------------------------------------------------------------------------
revoke execute on all functions in schema public from public;

revoke execute on all functions in schema public from anon;

-- ----------------------------------------------------------------------------
-- PASSO 3 - Reabrir SO o que a RLS precisa para avaliar policies como anon
-- ----------------------------------------------------------------------------
grant execute on function public.get_user_org_id(uuid) to anon;
grant execute on function public.has_role(uuid, public.app_role) to anon;
grant execute on function public.is_admin_or_tecnico(uuid) to anon;
grant execute on function public.is_platform_admin(uuid) to anon;

-- ----------------------------------------------------------------------------
-- PASSO 4 - Conferir o resultado
--   Esperado: so as 4 funcoes acima continuam executaveis por anon; e
--   authenticated/service_role seguem com EXECUTE em tudo.
-- ----------------------------------------------------------------------------
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prokind = 'f'
--    and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1;

-- ----------------------------------------------------------------------------
-- REVERSAO (so se algum fluxo anonimo inesperado parar)
-- ----------------------------------------------------------------------------
-- grant execute on all functions in schema public to public;
