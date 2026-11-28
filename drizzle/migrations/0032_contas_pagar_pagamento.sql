-- ============================================================================
-- 0032 - Contas a pagar: pagamento com saldo, policy de delete e RPC
--
-- Aditivo: adiciona colunas de pagamento em public.contas_pagar, a policy de
-- DELETE que faltava e a funcao public.pagar_conta_pagar. Nao altera dado
-- existente (as colunas novas entram com default / sao geradas).
--
-- Importante: o pagamento NAO lanca nada em public.financeiro, porque o DRE
-- (get_dre_simplificada) ja le as despesas operacionais de contas_pagar pago.
--
-- SQL completo e comentado em supabase/APROVACAO_contas_pagar.sql.
-- Aplicado em 2026-11-25 (comando a comando, em producao).
-- ============================================================================

alter table public.contas_pagar
  add column if not exists valor_pago numeric(12,2) not null default 0;

alter table public.contas_pagar
  add column if not exists saldo numeric(12,2) generated always as (valor - valor_pago) stored;

alter table public.contas_pagar
  add column if not exists observacoes text;

alter table public.contas_pagar
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists update_contas_pagar_updated_at on public.contas_pagar;
create trigger update_contas_pagar_updated_at
  before update on public.contas_pagar
  for each row execute function public.update_updated_at_column();

-- A tabela tinha grant DELETE mas nenhuma policy: apagar nao funcionava pela API.
drop policy if exists "Admin delete contas pagar" on public.contas_pagar;
create policy "Admin delete contas pagar" on public.contas_pagar
  for delete to authenticated
  using (organization_id = public.get_user_org_id(auth.uid()) and public.is_admin_or_tecnico(auth.uid()));

-- Contas a pagar e tabela financeira: nao expor ao anon.
revoke select on table public.contas_pagar from anon;

-- Funcao pagar_conta_pagar: ver supabase/APROVACAO_contas_pagar.sql (bloco 3).
-- Soma valor_pago, marca a conta como 'pago' ao zerar o saldo e registra a nota
-- do pagamento em observacoes, com guarda de organizacao e de papel.
