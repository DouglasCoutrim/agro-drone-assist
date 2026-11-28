-- ============================================================================
-- Revoga as concessoes desnecessarias do papel 'anon' em public.subscription_plans.
--
-- STATUS: APLICADO em 2026-11-21 (anon ficou apenas com SELECT). Este arquivo
-- fica como registro.
--
-- Contexto: o papel 'anon' (requisicao sem login, via Data API) tem hoje
-- SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER e MAINTAIN
-- concedidos nessa tabela. Nao existe policy para 'anon', entao o RLS ja barra
-- leitura e escrita comuns pelo Data API -- mas TRUNCATE e MAINTAIN NAO passam
-- por RLS, e todas as demais concessoes sao desnecessarias para quem nao fez
-- login. Mesmo padrao ja visto em nfe_config na Fase 0.
--
-- Verificado antes de escrever este arquivo (somente leitura):
--   - pg_has_role('authenticated','anon','MEMBER') = false
--     Revogar de 'anon' NAO tira privilegio de usuario logado.
--   - As 3 policies da tabela sao todas TO authenticated (nenhuma TO anon).
--   - Servidor PostgreSQL 17.11 (MAINTAIN existe a partir do 17).
--   - 'authenticated' e 'service_role' nao sao tocados por este arquivo.
--
-- O que este arquivo NAO faz: nao remove o SELECT de 'anon' de proposito, por
-- causa da decisao pendente no fim do arquivo (landing publica). Nenhum dado e
-- apagado e nenhuma coluna e alterada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VERIFICACAO (somente leitura)
-- ----------------------------------------------------------------------------
-- Antes: deve listar 7 linhas (DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
-- TRUNCATE, UPDATE). MAINTAIN nao aparece no information_schema.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'subscription_plans' and grantee = 'anon'
order by privilege_type;

select has_table_privilege('anon', 'public.subscription_plans', 'MAINTAIN') as anon_pode_maintain;

-- ----------------------------------------------------------------------------
-- ATUALIZACAO (executar somente apos aprovacao)
-- ----------------------------------------------------------------------------
begin;

revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.subscription_plans from anon;

-- Conferencia dentro da transacao: deve sobrar apenas SELECT para 'anon',
-- e 'authenticated' deve continuar com as 7 concessoes + MAINTAIN.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'subscription_plans'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

select has_table_privilege('anon', 'public.subscription_plans', 'MAINTAIN') as anon_pode_maintain,
       has_table_privilege('authenticated', 'public.subscription_plans', 'MAINTAIN') as auth_pode_maintain;

commit;

-- ----------------------------------------------------------------------------
-- DECISAO PENDENTE (nao executar junto): a landing publica mostra precos?
--
-- Hoje nao existe policy para 'anon'. Efeito pratico: a consulta
--   supabase.from('subscription_plans').select('*').eq('active', true)
-- feita em src/pages/Landing.tsx devolve ZERO linhas para visitante sem login --
-- a secao de planos da pagina publica chega vazia. O SELECT de 'anon' foi
-- mantido aqui justamente para nao fechar essa porta antes da sua decisao.
--
-- Se a decisao for EXIBIR os planos publicamente, rode tambem:
--
--   create policy "Visitantes veem planos ativos" on public.subscription_plans
--     for select to anon using (active = true);
--
-- Se a decisao for NAO exibir (plano so para quem esta logado), revogue tambem:
--
--   revoke select on table public.subscription_plans from anon;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- OPCIONAL / EM SEPARADO: 'authenticated' tambem tem TRUNCATE, REFERENCES,
-- TRIGGER e MAINTAIN concedidos, que o app nao usa (o CRUD de planos passa pela
-- policy de platform admin, e TRUNCATE nao passa por RLS). Revogar so esses
-- quatro NAO afeta INSERT/UPDATE/DELETE/SELECT usados pelo painel:
--
--   revoke truncate, references, trigger, maintain
--     on table public.subscription_plans from authenticated;
--
-- Fora do escopo deste arquivo: as duas policies de admin duplicadas
-- ("Platform admins manage plans" e "Platform admins manage all subscription_plans",
-- expressoes identicas). A remocao de uma delas fica para uma decisao separada,
-- porque DROP POLICY e alteracao de autorizacao.
-- ----------------------------------------------------------------------------
