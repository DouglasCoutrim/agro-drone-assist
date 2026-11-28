-- ============================================================================
-- 0030 - Hardening de privilegios do papel `anon`
--
-- Fecha o acesso anonimo a escrita de tabelas, a sequences e as RPC, sem tocar
-- em nada que o app (authenticated/service_role) use. Ver detalhes e as
-- verificacoes em supabase/APROVACAO_revogar_anon_escrita_public.sql e
-- supabase/APROVACAO_fechar_rpc_anon.sql.
--
-- Contexto: o schema public nasceu com o padrao do Supabase, que concede tudo
-- (inclusive TRUNCATE e MAINTAIN, que NAO passam por RLS) a anon, e deixa o
-- EXECUTE das funcoes via PUBLIC. `anon` e quem ainda nao fez login — a chave
-- publicavel vai no bundle do site.
--
-- Aplicado em 2026-11-22 (comando a comando, em producao).
-- ============================================================================

-- 1) anon perde escrita em tabelas (RLS ja barrava; TRUNCATE/MAINTAIN nao)
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;
revoke maintain on all tables in schema public from anon;

-- 2) anon perde acesso a sequences (nao ha insert anonimo)
revoke usage, select, update on all sequences in schema public from anon;

-- 3) authenticated nao precisa de TRUNCATE/REFERENCES/TRIGGER/MAINTAIN
revoke truncate, references, trigger, maintain
  on all tables in schema public from authenticated;

-- 4) anon perde EXECUTE das RPC (PUBLIC primeiro; authenticated e service_role
--    tem grant direto e seguem intactos)
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- 5) reabre SO as funcoes auxiliares usadas dentro de policies de RLS, para uma
--    consulta anonima a profiles/user_roles/site_config/Storage continuar
--    retornando vazio em vez de "permission denied"
grant execute on function public.get_user_org_id(uuid) to anon;
grant execute on function public.has_role(uuid, public.app_role) to anon;
grant execute on function public.is_admin_or_tecnico(uuid) to anon;
grant execute on function public.is_platform_admin(uuid) to anon;

notify pgrst, 'reload schema';
