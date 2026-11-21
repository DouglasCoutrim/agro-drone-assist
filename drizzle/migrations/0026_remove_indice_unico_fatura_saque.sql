-- =====================================================================
-- 0026 — Remove o índice único que impedia mais de uma OS na fatura de saque
--
-- A migration 0024 criou:
--   CREATE UNIQUE INDEX IF NOT EXISTS ordens_servico_payout_invoice_uq
--     ON public.ordens_servico (payout_invoice_id) WHERE payout_invoice_id IS NOT NULL;
--
-- Um índice único de UMA coluna aceita cada valor uma única vez. Mas o RPC
-- `create_technician_payout_invoice` grava o MESMO id de fatura em TODAS as OS
-- selecionadas:
--   UPDATE public.ordens_servico SET payout_invoice_id = v_invoice WHERE id = ANY(_os_ids);
-- A partir da segunda OS o PostgreSQL levantava
--   duplicate key value violates unique constraint "ordens_servico_payout_invoice_uq"
-- o frontend traduzia para "Este registro já está cadastrado (valor duplicado)."
-- (src/lib/formatters.ts) e a transação voltava inteira — nem a fatura nem os itens
-- nem o vínculo nas OS eram gravados.
--
-- Consequência observada em produção: `technician_payout_invoices` com 0 linhas e
-- nenhuma OS com `payout_invoice_id` preenchido, embora houvesse 31 OS concluídas
-- elegíveis. Fatura com uma única OS funcionava; com duas ou mais, falhava sempre.
--
-- A garantia pretendida ("uma OS só pode estar em uma fatura ativa") não precisa de
-- índice: a coluna guarda um valor por OS, então uma OS nunca aponta para duas
-- faturas. O RPC já exige `payout_invoice_id IS NULL` para aceitar a OS, sob advisory
-- lock por organização, e `os_commission_core` não recalcula OS com fatura.
--
-- O índice NÃO único abaixo mantém indexadas as buscas por fatura usadas por
-- settle / cancel / recusar (`WHERE payout_invoice_id = _invoice_id`), agora sem
-- limitar a quantidade de OS por fatura. Nenhum dado é apagado.
--
-- Aplicado em produção em 2026-11-21; este arquivo registra o mesmo comando no
-- histórico para que um apply do zero não recrie o bug.
-- =====================================================================

DROP INDEX IF EXISTS public.ordens_servico_payout_invoice_uq;

CREATE INDEX IF NOT EXISTS ordens_servico_payout_invoice_idx
  ON public.ordens_servico (payout_invoice_id)
  WHERE payout_invoice_id IS NOT NULL;
