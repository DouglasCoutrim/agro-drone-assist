-- 0033 - Checkout público sem login
-- O SQL completo e comentado está em supabase/APROVACAO_checkout_publico.sql.
-- Este arquivo é o registro do comando aprovado; não executar via drizzle-kit.

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_slug text not null check (plan_slug in ('bronze', 'prata', 'ouro')),
  billing_cycle text not null default 'mensal' check (billing_cycle in ('mensal', 'semestral', 'anual')),
  token_hash text not null unique,
  status text not null default 'created' check (status in ('created', 'awaiting_payment', 'paid', 'expired', 'cancelled', 'failed')),
  invoice_id uuid null,
  asaas_customer_id text null,
  asaas_charge_id text null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  completed_at timestamptz null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checkout_sessions_org on public.checkout_sessions(organization_id);
create index if not exists idx_checkout_sessions_status on public.checkout_sessions(status);
create index if not exists idx_checkout_sessions_expires on public.checkout_sessions(expires_at);

alter table public.tenant_invoices
  add column if not exists checkout_session_id uuid references public.checkout_sessions(id),
  add column if not exists billing_cycle text,
  add column if not exists asaas_environment text,
  add column if not exists payment_method text,
  add column if not exists bank_slip_url text,
  add column if not exists barcode text,
  add column if not exists failure_reason text,
  add column if not exists last_webhook_event text;

create unique index if not exists uq_tenant_invoices_checkout_session
  on public.tenant_invoices(checkout_session_id)
  where checkout_session_id is not null;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  asaas_payment_id text,
  payload_hash text,
  status text not null default 'processing',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_webhook_events_payment on public.payment_webhook_events(asaas_payment_id);
alter table public.checkout_sessions enable row level security;
alter table public.payment_webhook_events enable row level security;
revoke all on public.checkout_sessions from public, anon, authenticated;
revoke all on public.payment_webhook_events from public, anon, authenticated;
revoke insert, update on public.tenant_invoices from anon;

drop trigger if exists trg_checkout_sessions_updated_at on public.checkout_sessions;
create trigger trg_checkout_sessions_updated_at before update on public.checkout_sessions
for each row execute function public.update_updated_at_column();
