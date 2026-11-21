-- ============================================================================
-- Corrige a criacao da fatura de saque: remove o indice unico que impede mais
-- de uma OS na mesma fatura.
--
-- STATUS: AGUARDANDO APROVACAO. Nada deste arquivo foi executado no banco.
--
-- SINTOMA RELATADO
--   Ao gerar a fatura de saque o sistema nao salva e responde que o registro
--   "ja esta cadastrado (valor duplicado)", mesmo nao existindo nenhuma fatura.
--
-- CAUSA
--   Existe um indice UNICO sobre uma UNICA coluna:
--     public.ordens_servico_payout_invoice_uq
--     CREATE UNIQUE INDEX ordens_servico_payout_invoice_uq
--       ON public.ordens_servico (payout_invoice_id)
--       WHERE payout_invoice_id IS NOT NULL;
--   (drizzle/migrations/0024_commission_rateio_e_faturas.sql, linhas 137-138)
--
--   Um indice unico de uma coluna aceita cada valor UMA unica vez. Como
--   public.create_technician_payout_invoice grava o MESMO id de fatura em TODAS
--   as OS selecionadas:
--     update public.ordens_servico
--        set payout_invoice_id = v_invoice
--      where id = any(_os_ids);
--   a partir da SEGUNDA OS o PostgreSQL levanta
--     duplicate key value violates unique constraint "ordens_servico_payout_invoice_uq"
--   o front traduz para "Este registro ja esta cadastrado (valor duplicado)."
--   (src/lib/formatters.ts) e a transacao inteira volta atras -- por isso nem a
--   fatura nem os itens nem o vinculo nas OS sao gravados. Uma fatura com UMA
--   unica OS passa; com duas ou mais, falha sempre.
--
--   Prova no banco: technician_payout_invoices tem 0 linhas e nenhuma OS tem
--   payout_invoice_id preenchido, embora existam OS concluidas elegiveis.
--   O indice esta indisunique=true, indisvalid=true e indimmediate=true
--   (nao e diferivel: a violacao estoura na hora, no proprio UPDATE).
--
-- POR QUE REMOVER E SEGURO
--   A intencao declarada ("uma OS so pode estar em uma fatura ativa") nao
--   precisa de indice: a coluna guarda um valor por OS, entao uma OS nunca
--   aponta para duas faturas. O RPC ja exige payout_invoice_id is null para
--   aceitar a OS, sob advisory lock por organizacao, e os_commission_core nao
--   recalcula OS com fatura. Nenhum dado e apagado por este arquivo.
--
-- 1) Rode o bloco de VERIFICACAO e confira.
-- 2) So depois rode o bloco de ATUALIZACAO. O ajuste e pequeno e reversivel.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VERIFICACAO (somente leitura)
-- ----------------------------------------------------------------------------
-- 1) O indice existe, e unico e esta ativo
select i.indexrelid::regclass::text as indice,
       i.indisunique as unico, i.indisvalid as valido, i.indimmediate as imediato,
       pg_get_indexdef(i.indexrelid) as definicao
from pg_index i
where i.indexrelid = 'public.ordens_servico_payout_invoice_uq'::regclass;

-- 2) Estado atual: a tabela de faturas esta vazia e nenhuma OS esta vinculada
select (select count(*) from public.technician_payout_invoices) as faturas_existentes,
       (select count(*) from public.ordens_servico where payout_invoice_id is not null) as os_com_fatura;

-- 3) OS elegiveis por tecnico: mais de uma na mesma organizacao e exatamente o
--    caso que hoje falha
select os.organization_id, os.tecnico_id, count(*) as os_elegiveis
from public.ordens_servico os
where public.os_status_grupo(os.status::text) = 'CONCLUIDA'
  and os.payout_invoice_id is null
group by os.organization_id, os.tecnico_id
order by os_elegiveis desc;

-- 4) Controle: nada mais na coluna depende desse indice
select count(*) as os_apontando_para_fatura_inexistente
from public.ordens_servico os
where os.payout_invoice_id is not null
  and not exists (select 1 from public.technician_payout_invoices i where i.id = os.payout_invoice_id);

-- ----------------------------------------------------------------------------
-- ATUALIZACAO (executar somente apos aprovacao)
-- ----------------------------------------------------------------------------
begin;

-- Remove o indice que restringe a fatura a uma unica OS.
drop index if exists public.ordens_servico_payout_invoice_uq;

-- Substitui por um indice NAO unico: as rotinas que buscam OS por fatura
-- (settle / cancel / recusar usam "where payout_invoice_id = _invoice_id")
-- continuam indexadas, agora sem restringir a quantidade de OS por fatura.
create index if not exists ordens_servico_payout_invoice_idx
  on public.ordens_servico (payout_invoice_id)
  where payout_invoice_id is not null;

-- Conferencia dentro da transacao
-- a) o indice unico deve ter desaparecido (esperado: 0)
select count(*) as indice_unico_ainda_existe
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'ordens_servico_payout_invoice_uq';

-- b) o indice novo deve existir (esperado: 1)
select count(*) as indice_novo_existe
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'ordens_servico_payout_invoice_idx';

-- c) nada foi perdido: mesma contagem de faturas e de OS vinculadas
select (select count(*) from public.technician_payout_invoices) as faturas_existentes,
       (select count(*) from public.ordens_servico where payout_invoice_id is not null) as os_com_fatura;

commit;

-- ----------------------------------------------------------------------------
-- TESTE DEPOIS DE APLICAR (pela tela, nao por SQL)
--   Abra o painel financeiro do tecnico, selecione DUAS ou mais OS concluidas
--   com situacao "A receber", gere a fatura de saque e confira:
--     - a fatura aparece como rascunho, com numero FAT-0001;
--     - as duas OS ficam com o mesmo payout_invoice_id;
--     - a coluna Fatura do extrato mostra "#FAT-0001 (rascunho)".
--   Se quiser conferir por SQL logo depois:
--     select numero, status, total from public.technician_payout_invoices order by created_at desc limit 5;
--     select numero, payout_invoice_id from public.ordens_servico
--      where payout_invoice_id is not null order by numero;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- PENDENCIA RELACIONADA (decisao sua, nao faz parte deste arquivo)
--   O indice tambem esta escrito na migration
--   drizzle/migrations/0024_commission_rateio_e_faturas.sql (linhas 137-138).
--   Como a regra do projeto e nao reescrever migration existente, o ajuste
--   precisa entrar em uma migration NOVA que execute o mesmo DROP -- senao um
--   apply do zero recria o indice e o bug volta. Qual pasta de migrations e a
--   fonte de verdade continua pendente da Fase 5.
-- ----------------------------------------------------------------------------
