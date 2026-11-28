-- ============================================================================
-- LivreOS - Contas a pagar (tela + pagamento com saldo/parcial)
--
-- A tabela public.contas_pagar ja existia (migration 20260919230049) com RLS,
-- mas nunca teve tela. Aqui ela ganha o que falta para o fluxo de pagamento,
-- espelhando as contas a receber.
--
-- ADITIVO + policy nova. Nao altera dado existente: as colunas novas entram com
-- default (valor_pago = 0) e a de saldo e gerada.
--
-- IMPORTANTE: o pagamento NAO lanca nada em public.financeiro de proposito. O
-- DRE (get_dre_simplificada) ja le as despesas operacionais de contas_pagar com
-- status = 'pago'. Lancar tambem em financeiro duplicaria a despesa na base.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Colunas de pagamento
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2) Policy de DELETE (a tabela tinha grant DELETE mas nenhuma policy, entao
--    apagar nao funcionava pela API)
-- ----------------------------------------------------------------------------
drop policy if exists "Admin delete contas pagar" on public.contas_pagar;
create policy "Admin delete contas pagar" on public.contas_pagar
  for delete to authenticated
  using (organization_id = public.get_user_org_id(auth.uid()) and public.is_admin_or_tecnico(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3) RPC pagar_conta_pagar
-- ----------------------------------------------------------------------------
create or replace function public.pagar_conta_pagar(
  p_conta_id uuid,
  p_valor numeric,
  p_forma text default null,
  p_obs text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  _uid uuid := auth.uid();
  _org uuid;
  _valor numeric(12,2);
  _valor_pago numeric(12,2);
  _saldo numeric(12,2);
  _nota text;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor pago maior que zero.';
  end if;

  select cp.organization_id, cp.valor, cp.valor_pago
    into _org, _valor, _valor_pago
    from public.contas_pagar cp
   where cp.id = p_conta_id
   for update;

  if _org is null then
    raise exception 'Conta a pagar nao encontrada.';
  end if;

  if _uid is not null
     and not public.is_platform_admin(_uid)
     and _org is distinct from public.get_user_org_id(_uid) then
    raise exception 'Conta de outra organizacao.' using errcode = '42501';
  end if;

  if _uid is not null
     and not public.is_platform_admin(_uid)
     and not public.is_admin_or_tecnico(_uid) then
    raise exception 'Sem permissao para registrar pagamento.' using errcode = '42501';
  end if;

  _valor_pago := round(coalesce(_valor_pago, 0) + p_valor, 2);
  _saldo := round(coalesce(_valor, 0) - _valor_pago, 2);

  _nota := 'Pago ' || p_valor::text || ' em ' || to_char(current_date, 'DD/MM/YYYY')
           || case when nullif(btrim(coalesce(p_forma, '')), '') is not null
                   then ' (' || btrim(p_forma) || ')' else '' end;

  update public.contas_pagar
     set valor_pago = _valor_pago,
         status = case when _saldo <= 0.004 then 'pago' else status end,
         observacoes = nullif(concat_ws(' | ',
                          nullif(btrim(coalesce(observacoes, '')), ''),
                          _nota,
                          nullif(btrim(coalesce(p_obs, '')), '')), '')
   where id = p_conta_id;

  return jsonb_build_object('conta_id', p_conta_id, 'total', _valor, 'pago', _valor_pago, 'saldo', greatest(_saldo, 0));
end
$function$;

comment on function public.pagar_conta_pagar(uuid, numeric, text, text) is
  'Registra o pagamento (parcial ou total) de uma conta a pagar: soma valor_pago e marca como pago ao zerar o saldo. Guarda de organizacao e de papel por dentro. Nao lanca em financeiro (o DRE ja le as despesas de contas_pagar).';

revoke all on function public.pagar_conta_pagar(uuid, numeric, text, text) from public;
revoke all on function public.pagar_conta_pagar(uuid, numeric, text, text) from anon;
grant execute on function public.pagar_conta_pagar(uuid, numeric, text, text) to authenticated;
grant execute on function public.pagar_conta_pagar(uuid, numeric, text, text) to service_role;

-- Contas a pagar e tabela financeira: nao expor nada ao anon.
revoke select on table public.contas_pagar from anon;

notify pgrst, 'reload schema';
