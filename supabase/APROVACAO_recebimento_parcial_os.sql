-- ============================================================================
-- LivreOS - Recebimento parcial de OS + contas a receber
--
-- Pedido: ao registrar o recebimento de uma OS, poder marcar recebimento
-- parcial, informar o equipamento que esta sendo retirado, o valor pago, o
-- saldo que fica em aberto e as condicoes de pagamento. O saldo vira uma
-- "conta a receber" com vencimento, para cobrar depois. A OS fica em aberto
-- ate quitar.
--
-- Puramente ADITIVO: cria uma tabela nova (contas_receber) e uma funcao nova
-- (registrar_recebimento_os). Nao altera coluna nem dado existente. O
-- lancamento no Financeiro continua na mesma tabela `financeiro` (uma receita
-- por pagamento).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabela contas_receber
-- ----------------------------------------------------------------------------
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
create index if not exists contas_receber_org_idx on public.contas_receber (organization_id);
create index if not exists contas_receber_status_idx on public.contas_receber (organization_id, status);

alter table public.contas_receber enable row level security;

revoke all on public.contas_receber from public;
revoke all on public.contas_receber from anon;
grant select, insert, update, delete on public.contas_receber to authenticated;
grant all on public.contas_receber to service_role;

drop policy if exists "Org members view contas_receber" on public.contas_receber;
create policy "Org members view contas_receber" on public.contas_receber
  for select to authenticated using (organization_id = public.get_user_org_id(auth.uid()));

drop policy if exists "Org admin_tecnico manage contas_receber" on public.contas_receber;
create policy "Org admin_tecnico manage contas_receber" on public.contas_receber
  for all to authenticated
  using (organization_id = public.get_user_org_id(auth.uid()) and public.is_admin_or_tecnico(auth.uid()))
  with check (organization_id = public.get_user_org_id(auth.uid()) and public.is_admin_or_tecnico(auth.uid()));

drop policy if exists "Platform admins manage all contas_receber" on public.contas_receber;
create policy "Platform admins manage all contas_receber" on public.contas_receber
  for all to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

drop trigger if exists update_contas_receber_updated_at on public.contas_receber;
create trigger update_contas_receber_updated_at
  before update on public.contas_receber
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_audit on public.contas_receber;
create trigger trg_audit
  after insert or update or delete on public.contas_receber
  for each row execute function public.audit_row();

comment on table public.contas_receber is
  'Saldo em aberto de uma OS (recebimento parcial). valor = total da OS, valor_recebido = soma dos pagamentos, saldo = em aberto.';

-- ----------------------------------------------------------------------------
-- 2) Funcao registrar_recebimento_os
-- ----------------------------------------------------------------------------
create or replace function public.registrar_recebimento_os(
  p_os_id uuid,
  p_valor numeric,
  p_forma text default null,
  p_equipamento text default null,
  p_condicoes text default null,
  p_vencimento date default null,
  p_obs text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  _uid uuid := auth.uid();
  _org uuid;
  _cliente uuid;
  _numero text;
  _valor_final numeric(12,2);
  _total numeric(12,2);
  _pago numeric(12,2);
  _saldo numeric(12,2);
  _conta uuid;
  _obs text;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor recebido maior que zero.';
  end if;

  select os.organization_id, os.cliente_id, os.numero, os.valor_final
    into _org, _cliente, _numero, _valor_final
    from public.ordens_servico os
   where os.id = p_os_id
   for update;

  if _org is null then
    raise exception 'Ordem de servico nao encontrada.';
  end if;

  -- Guarda de organizacao (mesmo modelo de os_commission_core).
  if _uid is not null
     and not public.is_platform_admin(_uid)
     and _org is distinct from public.get_user_org_id(_uid) then
    raise exception 'Ordem de servico de outra organizacao.' using errcode = '42501';
  end if;

  -- Gravar no Financeiro exige admin ou tecnico (o RPC roda como definer e
  -- passaria por cima da RLS de financeiro, que e admin-only).
  if _uid is not null
     and not public.is_platform_admin(_uid)
     and not public.is_admin_or_tecnico(_uid) then
    raise exception 'Sem permissao para registrar recebimento.' using errcode = '42501';
  end if;

  -- Total cobravel: valor_final > orcamento > itens - desconto.
  _total := coalesce(_valor_final, 0);
  if _total <= 0 then
    select coalesce(os.valor_orcamento, 0) into _total from public.ordens_servico os where os.id = p_os_id;
  end if;
  if _total <= 0 then
    select greatest(0,
             coalesce(sum(i.valor_total), 0)
             - coalesce((select os.desconto from public.ordens_servico os where os.id = p_os_id), 0))
      into _total
      from public.itens_os i
     where i.ordem_servico_id = p_os_id;
  end if;

  -- Quanto ja foi recebido nessa OS antes deste lancamento.
  select coalesce(sum(f.valor), 0) into _pago
    from public.financeiro f
   where f.ordem_servico_id = p_os_id and f.tipo = 'receita';

  _obs := nullif(concat_ws(' | ',
            nullif('Forma: ' || coalesce(btrim(p_forma), ''), 'Forma: '),
            nullif(btrim(p_obs), '')), '');

  insert into public.financeiro
    (organization_id, ordem_servico_id, usuario_id, tipo, categoria, descricao, valor, data_transacao, observacoes)
  values
    (_org, p_os_id, _uid, 'receita', 'Serviços',
     'Recebimento OS ' || coalesce(_numero, ''), p_valor, current_date, _obs);

  _pago := round(_pago + p_valor, 2);
  _saldo := round(_total - _pago, 2);

  if _saldo > 0.004 then
    insert into public.contas_receber
      (organization_id, ordem_servico_id, cliente_id, descricao, equipamento, valor, valor_recebido, vencimento, condicoes_pagamento, status, observacoes, created_by)
    values
      (_org, p_os_id, _cliente, 'Saldo da OS ' || coalesce(_numero, ''), nullif(btrim(p_equipamento), ''),
       _total, _pago, p_vencimento, nullif(btrim(p_condicoes), ''), 'aberto', _obs, _uid)
    on conflict (ordem_servico_id) do update
      set valor = excluded.valor,
          valor_recebido = excluded.valor_recebido,
          vencimento = coalesce(excluded.vencimento, public.contas_receber.vencimento),
          condicoes_pagamento = coalesce(excluded.condicoes_pagamento, public.contas_receber.condicoes_pagamento),
          equipamento = coalesce(excluded.equipamento, public.contas_receber.equipamento),
          status = 'aberto',
          updated_at = now()
    returning id into _conta;
  else
    update public.contas_receber
       set valor_recebido = _pago, status = 'quitado', updated_at = now()
     where ordem_servico_id = p_os_id
     returning id into _conta;
    _saldo := 0;
  end if;

  -- Garante valor_final preenchido quando a OS ainda nao tinha valor.
  if coalesce(_valor_final, 0) <= 0 and _total > 0 then
    update public.ordens_servico set valor_final = _total where id = p_os_id;
  end if;

  return jsonb_build_object('os_id', p_os_id, 'total', _total, 'pago', _pago, 'saldo', _saldo, 'conta_id', _conta);
end
$function$;

comment on function public.registrar_recebimento_os(uuid, numeric, text, text, text, date, text) is
  'Registra um pagamento (parcial ou total) de uma OS: lanca a receita no Financeiro e cria/atualiza a conta a receber do saldo. Guarda de organizacao por dentro.';

revoke all on function public.registrar_recebimento_os(uuid, numeric, text, text, text, date, text) from public;
revoke all on function public.registrar_recebimento_os(uuid, numeric, text, text, text, date, text) from anon;
grant execute on function public.registrar_recebimento_os(uuid, numeric, text, text, text, date, text) to authenticated;
grant execute on function public.registrar_recebimento_os(uuid, numeric, text, text, text, date, text) to service_role;

notify pgrst, 'reload schema';
