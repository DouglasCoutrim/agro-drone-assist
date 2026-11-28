-- ============================================================================
-- LivreOS - Hardening: o papel `anon` nao precisa de escrita em lugar nenhum
--
-- CONTEXTO (verificado por leitura antes de escrever este arquivo):
--   - Todo o schema public nasceu com o padrao do Supabase: INSERT, UPDATE,
--     DELETE, TRUNCATE, REFERENCES e TRIGGER concedidos a `anon` em praticamente
--     todas as tabelas.
--   - `anon` e o papel de quem ainda nao fez login (a chave publicavel vai no
--     bundle do site). O app nao escreve nada sem sessao; so a landing le
--     `site_config` e `subscription_plans` (SELECT).
--   - TODAS as tabelas de public estao com RLS ligado (conferido:
--     `relrowsecurity = false` nao retorna nenhuma linha), e nao existe policy
--     de escrita efetiva para `anon` (as policies FOR ALL/DELETE/UPDATE que
--     aparecem sao `TO public`, mas dependem de `is_platform_admin(auth.uid())`
--     ou do admin da organizacao, que sao falsos para `anon`).
--
-- POR QUE ISSO E SEGURO (nao muda nenhum comportamento do app):
--   A RLS ja barrava todo o CRUD de `anon`; o `TRUNCATE` e o unico privilegio
--   que NAO passa por RLS, e `REFERENCES`/`TRIGGER` so valem para DDL. Nenhuma
--   consulta legitima do app e feita como `anon` alem de SELECT.
--
-- O QUE ESTE ARQUIVO FAZ:
--   Revoga de `anon` INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER em
--   todas as tabelas de public. NAO toca em SELECT (a landing continua lendo) e
--   NAO toca em `authenticated` nem `service_role`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASSO 1 - Conferir (leitura, registrar antes de mudar)
-- ----------------------------------------------------------------------------
-- select c.relname, a.privilege_type
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   join information_schema.role_table_grants a
--     on a.table_name = c.relname and a.table_schema = 'public'
--  where n.nspname = 'public' and c.relkind = 'r' and a.grantee = 'anon'
--    and a.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
--  order by c.relname, a.privilege_type;

-- ----------------------------------------------------------------------------
-- PASSO 2 - Revogar a escrita de anon (tudo menos SELECT)
-- ----------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon;

-- ----------------------------------------------------------------------------
-- PASSO 3 - Conferir o resultado (nao deve sobrar nenhuma linha)
-- ----------------------------------------------------------------------------
-- (mesma consulta do PASSO 1)

-- ----------------------------------------------------------------------------
-- REVERSAO (so se algo inesperado depender de escrita anonima; hoje nada
-- depende, porque a RLS ja barrava)
-- ----------------------------------------------------------------------------
-- grant insert, update, delete, truncate, references, trigger
--   on all tables in schema public to anon;
