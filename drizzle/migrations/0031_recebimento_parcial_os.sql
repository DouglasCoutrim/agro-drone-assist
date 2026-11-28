-- ============================================================================
-- 0031 - Recebimento parcial de OS + contas a receber
--
-- Aditivo: cria a tabela public.contas_receber e a funcao
-- public.registrar_recebimento_os. Nao altera dado nem coluna existente.
-- SQL completo e comentado em supabase/APROVACAO_recebimento_parcial_os.sql.
-- Aplicado em 2026-11-22 (comando a comando, em producao).
-- ============================================================================

create table if not exists public.contas_receber (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id),
  ordem_servico_id uuid references public.ordens_servico(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  descricao text,
  equipamento text,
  valor numeric(12,2) not null default 0,
  valor_recebido numeric(12,2) not null default 0,
  saldo numeric(12,2) generated always as (valor - valor_recebido) stored,
  vencimento date,
  condicoes_pagamento text,
  status text not null default 'aberto',
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contas_receber_status_check check (status in ('aberto', 'quitado', 'cancelado'))
);

create unique index if not exists contas_receber_os_key on public.contas_receber (ordem_servico_id);
create index if not exists contas_receber_status_idx on public.contas_receber (organization_id, status);

alter table public.contas_receber enable row level security;

revoke all on public.contas_receber from public;
revoke all on public.contas_receber from anon;
grant select, insert, update, delete on public.contas_receber to authenticated;
grant all on public.contas_receber to service_role;

create policy "Org members view contas_receber" on public.contas_receber
  for select to authenticated using (organization_id = public.get_user_org_id(auth.uid()));

create policy "Org admin_tecnico manage contas_receber" on public.contas_receber
  for all to authenticated
  using (organization_id = public.get_user_org_id(auth.uid()) and public.is_admin_or_tecnico(auth.uid()))
  with check (organization_id = public.get_user_org_id(auth.uid()) and public.is_admin_or_tecnico(auth.uid()));

create policy "Platform admins manage all contas_receber" on public.contas_receber
  for all to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

create trigger update_contas_receber_updated_at
  before update on public.contas_receber
  for each row execute function public.update_updated_at_column();

create trigger trg_audit
  after insert or update or delete on public.contas_receber
  for each row execute function public.audit_row();

-- Funcao registrar_recebimento_os: ver supabase/APROVACAO_recebimento_parcial_os.sql
-- (bloco 2). Ela lanca a receita em financeiro e faz upsert da conta a receber
-- por ordem_servico_id, com guarda de organizacao e de papel (admin/tecnico).
