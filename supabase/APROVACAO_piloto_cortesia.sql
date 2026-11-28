-- ============================================================================
-- PILOTO / CORTESIA INTERNA CONTROLADA PELA PLATAFORMA
--
-- Este arquivo é uma proposta de SQL. NÃO foi executado neste branch.
-- Execute primeiro o bloco VERIFICAÇÃO e, somente após aprovação, o bloco
-- ATUALIZAÇÃO em ambiente de teste e depois em produção.
--
-- Decisão pendente antes da execução:
--   v_piloto_max_users e v_piloto_max_os_per_month estão provisoriamente
--   iguais aos limites atuais do Ouro (10 e -1). Substitua pelos limites
--   aprovados antes de executar o bloco de atualização.
--
-- Revogação: por segurança, retorna a organização ao plano comercial Bronze.
-- A relação matriz/filhas não faz parte desta fase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VERIFICAÇÃO (somente SELECT; não altera dados)
-- ----------------------------------------------------------------------------
select slug, name, monthly_price, max_users, max_os_per_month, active,
       features, column_name
from public.subscription_plans
cross join lateral (
  select string_agg(column_name, ', ' order by column_name) as column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'subscription_plans'
    and column_name in ('visivel_publicamente', 'cobravel')
) columns_check
where slug in ('bronze', 'prata', 'ouro', 'Isento', 'piloto')
order by monthly_price, slug;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'organizations'
  and column_name in ('cortesia_ate', 'cortesia_concedida_por', 'cortesia_concedida_em')
order by column_name;

select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('conceder_cortesia', 'revogar_cortesia');

select slug
from public.subscription_plans
where slug = 'piloto';

-- ----------------------------------------------------------------------------
-- ATUALIZAÇÃO (executar somente após aprovação)
-- ----------------------------------------------------------------------------
begin;

alter table public.subscription_plans
  add column if not exists visivel_publicamente boolean not null default true,
  add column if not exists cobravel boolean not null default true;

alter table public.organizations
  add column if not exists cortesia_ate date,
  add column if not exists cortesia_concedida_por uuid references auth.users(id),
  add column if not exists cortesia_concedida_em timestamptz;

-- Plano interno: não aparece no catálogo público e nunca gera cobrança.
-- Os limites abaixo são provisórios e devem ser confirmados antes da execução.
insert into public.subscription_plans
  (slug, name, monthly_price, yearly_price, billing_cycle,
   max_users, max_os_per_month, features, active,
   visivel_publicamente, cobravel)
select
  'piloto', 'Piloto (cortesia)', 0, 0, 'monthly',
  10, -1,
  coalesce(ouro.features, '[]'::jsonb), true, false, false
from public.subscription_plans ouro
where ouro.slug = 'ouro'
on conflict (slug) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  yearly_price = excluded.yearly_price,
  billing_cycle = excluded.billing_cycle,
  max_users = excluded.max_users,
  max_os_per_month = excluded.max_os_per_month,
  features = excluded.features,
  active = excluded.active,
  visivel_publicamente = excluded.visivel_publicamente,
  cobravel = excluded.cobravel;

-- O plano legado Isento não é apagado se houver organizações usando-o.
-- Ele deixa de aparecer para empresas comuns, mas continua visível para a
-- administração da plataforma durante a transição.
update public.subscription_plans
set visivel_publicamente = false
where slug = 'Isento';

-- Organizações autenticadas só enxergam planos ativos e públicos. A exceção
-- de administrador da plataforma permite administrar planos internos.
drop policy if exists "Anyone authenticated can view active plans" on public.subscription_plans;
create policy "Authenticated users view public plans"
  on public.subscription_plans
  for select to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or (active = true and visivel_publicamente = true)
  );

create or replace function public.conceder_cortesia(
  _org uuid,
  _plan_slug text,
  _ate date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_platform_admin(v_caller) then
    raise exception 'Acesso negado';
  end if;

  if _ate is null or _ate < current_date then
    raise exception 'A data final da cortesia deve ser hoje ou uma data futura';
  end if;

  select * into v_plan
  from public.subscription_plans
  where slug = _plan_slug
    and active = true;

  if not found then
    raise exception 'Plano de cortesia não encontrado ou inativo';
  end if;

  if v_plan.cobravel then
    raise exception 'O plano informado é cobrável e não pode ser usado como cortesia';
  end if;

  update public.organizations
  set plan_id = v_plan.id,
      plan = v_plan.slug,
      monthly_fee = 0,
      max_users = v_plan.max_users,
      max_os_per_month = v_plan.max_os_per_month,
      cortesia_ate = _ate,
      cortesia_concedida_por = v_caller,
      cortesia_concedida_em = now(),
      updated_at = now()
  where id = _org;

  if not found then
    raise exception 'Organização não encontrada';
  end if;

  insert into public.admin_audit_log
    (action, organization_id, performed_by, target_id, details)
  values
    ('courtesy_granted', _org, v_caller, _org,
     jsonb_build_object('plan_slug', v_plan.slug, 'cortesia_ate', _ate));
end;
$$;

create or replace function public.revogar_cortesia(_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_platform_admin(v_caller) then
    raise exception 'Acesso negado';
  end if;

  select * into v_plan
  from public.subscription_plans
  where slug = 'bronze'
    and active = true
    and visivel_publicamente = true
    and cobravel = true;

  if not found then
    raise exception 'Plano comercial padrão Bronze não encontrado ou indisponível';
  end if;

  update public.organizations
  set plan_id = v_plan.id,
      plan = v_plan.slug,
      monthly_fee = v_plan.monthly_price,
      max_users = v_plan.max_users,
      max_os_per_month = v_plan.max_os_per_month,
      cortesia_ate = null,
      cortesia_concedida_por = null,
      cortesia_concedida_em = null,
      updated_at = now()
  where id = _org;

  if not found then
    raise exception 'Organização não encontrada';
  end if;

  insert into public.admin_audit_log
    (action, organization_id, performed_by, target_id, details)
  values
    ('courtesy_revoked', _org, v_caller, _org,
     jsonb_build_object('fallback_plan_slug', v_plan.slug));
end;
$$;

revoke all on function public.conceder_cortesia(uuid, text, date) from public, anon;
revoke all on function public.revogar_cortesia(uuid) from public, anon;
grant execute on function public.conceder_cortesia(uuid, text, date) to authenticated, service_role;
grant execute on function public.revogar_cortesia(uuid) to authenticated, service_role;

create index if not exists idx_organizations_cortesia_ate
  on public.organizations(cortesia_ate)
  where cortesia_ate is not null;

notify pgrst, 'reload schema';
commit;

-- ----------------------------------------------------------------------------
-- VERIFICAÇÃO PÓS-ATUALIZAÇÃO (somente SELECT)
-- ----------------------------------------------------------------------------
select slug, name, visivel_publicamente, cobravel, active,
       max_users, max_os_per_month, features
from public.subscription_plans
where slug in ('bronze', 'prata', 'ouro', 'Isento', 'piloto')
order by monthly_price, slug;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('conceder_cortesia', 'revogar_cortesia');
