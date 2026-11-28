-- ============================================================================
-- LivreOS - Limpeza de rota bloqueada que deixou de existir
--
-- STATUS: AGUARDANDO APROVACAO. Nada neste arquivo foi executado no banco.
--
-- Contexto: na Fase A o item de menu "Nova NF-e" (href "/vendas?nova=1&nfe=1") foi
-- retirado do menu. Hoje 1 usuario tem esse href na lista `rotas_bloqueadas`.
--
-- Por que a entrada esta inerte (e por que remover e neutro):
--   `matchNavHref` casa o endereco atual com a lista de itens PERMISSIONAVEIS. Depois
--   da Fase A essa lista nao contem "/vendas?nova=1&nfe=1", entao abrir esse endereco
--   cai no fallback por caminho e casa com "/vendas". Ou seja: a entrada com a query
--   nunca e lida. Remover nao concede nem tira acesso a nada - apenas limpa o registro
--   para ele nao voltar a valer sozinho se alguem reintroduzir o item no menu.
--
-- Observacao: quem quiser bloquear esse fluxo a partir de agora deve bloquear "/vendas".
--
-- Para reverter (se preciso): reinserir o href na lista do usuario.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASSO 1 - Conferir o estado atual (deve listar 1 usuario)
-- ----------------------------------------------------------------------------
-- select user_id, rotas_bloqueadas
--   from public.user_permissions
--  where '/vendas?nova=1&nfe=1' = any(rotas_bloqueadas);

-- ----------------------------------------------------------------------------
-- PASSO 2 - Remover apenas esse href, mantendo os outros bloqueios intactos
-- ----------------------------------------------------------------------------
update public.user_permissions
   set rotas_bloqueadas = array_remove(rotas_bloqueadas, '/vendas?nova=1&nfe=1'),
       updated_at = now()
 where '/vendas?nova=1&nfe=1' = any(rotas_bloqueadas);

-- ----------------------------------------------------------------------------
-- PASSO 3 - Conferir o resultado (deve voltar zero linhas)
-- ----------------------------------------------------------------------------
-- select user_id, rotas_bloqueadas
--   from public.user_permissions
--  where '/vendas?nova=1&nfe=1' = any(rotas_bloqueadas);
