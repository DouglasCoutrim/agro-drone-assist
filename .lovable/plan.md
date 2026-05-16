# Plano: SaaS Multi-Empresa com Super Admin

A base já tem `organizations` + `organization_id` em todas as tabelas e RLS por organização. Falta: onboarding de novas empresas, painel Super Admin (você), whitelabel real, billing/mensalidade e bloqueio automático.

## 1. Modelo de dados (migrações)

**Tabela `platform_admins`** — quem é Super Admin da plataforma (você).
- `user_id` (PK), `created_at`
- Função `is_platform_admin(uuid)` SECURITY DEFINER

**Estender `organizations`**:
- `plan` (text: trial/basic/pro/enterprise)
- `status` (text: active/trial/overdue/blocked/canceled)
- `trial_ends_at`, `next_due_date`, `monthly_fee` (numeric)
- `blocked_at`, `blocked_reason`
- `max_users`, `max_os_per_month` (limites do plano)

**Tabela `subscription_plans`** (catálogo de planos):
- `name`, `slug`, `monthly_price`, `max_users`, `max_os`, `features` (jsonb)

**Tabela `tenant_invoices`** (cobranças de mensalidade que VOCÊ emite para seus clientes):
- `organization_id`, `competencia` (YYYY-MM), `valor`, `vencimento`
- `status` (pendente/pago/vencido/cancelado)
- `asaas_charge_id`, `payment_url`, `pago_em`

**Estender `empresa_config`** (whitelabel):
- `cor_primaria`, `cor_secundaria`, `favicon_url`
- `dominio_personalizado`, `email_remetente`
- `gateway_pagamento` (asaas/stripe/mercadopago), `gateway_credentials` (jsonb encriptado)
- `subdominio` (ex: minhaoficina.voltmaster.app)

**RLS**: Super Admin (`is_platform_admin`) ganha acesso total a `organizations`, `tenant_invoices`, `profiles`, `subscription_plans`. Cada organização continua isolada por `organization_id`.

## 2. Onboarding de nova empresa

Fluxo público em `/cadastro-empresa`:
1. Form: nome empresa, CNPJ, responsável, e-mail, telefone, senha, plano escolhido
2. Cria `auth.user` → cria `organization` (owner_id = user) → vincula `profiles.organization_id` → role `admin` → `empresa_config` inicial → `trial_ends_at = now + 7 dias`
3. Tudo via Edge Function `signup-tenant` para garantir atomicidade

## 3. Painel Super Admin (`/admin-master`)

Rota protegida por `is_platform_admin`. Layout próprio (não usa sidebar de tenant). Páginas:

- **Dashboard**: MRR, total de tenants, ativos, em trial, inadimplentes, churn
- **Clientes (Tenants)**: lista de todas organizações com status, plano, último pagamento, ações (ver detalhes, alterar plano, bloquear/desbloquear, login como)
- **Cobranças**: gerar fatura manual, faturas em aberto, vencidas, pagas; botão "Gerar mensalidades do mês" que cria `tenant_invoices` para todos ativos
- **Planos**: CRUD de `subscription_plans`
- **Configurações da plataforma**: dados do seu Asaas master, templates de e-mail de cobrança

## 4. Cobrança de mensalidade + bloqueio

- Edge Function `generate-monthly-invoices` (cron diário): para cada org com `next_due_date <= hoje`, cria `tenant_invoice` + cobrança no SEU Asaas master → envia link por e-mail/WhatsApp
- Edge Function `asaas-webhook-platform` (separada da do tenant): recebe confirmação de pagamento → marca fatura paga → avança `next_due_date` +1 mês → garante `status = active`
- Edge Function `check-overdue-tenants` (cron diário): se fatura vencida há >X dias (configurável, ex: 5) → `organizations.status = 'blocked'`
- `ProtectedRoute` checa `organization.status`. Se `blocked`, redireciona para tela "Mensalidade em atraso" com link de pagamento. Super Admin nunca é bloqueado.

## 5. Whitelabel por empresa

- `useEmpresaConfig` já existe; estendê-lo para aplicar `cor_primaria/secundaria` em runtime via CSS variables (`--primary`, `--accent` no `:root`)
- Logo e nome da empresa já saem no PDF/sidebar
- Página `/empresa` ganha abas: **Identidade Visual**, **Gateway de Pagamento**, **Domínio**, **Termos**, **Templates WhatsApp**

## 6. Gateway de pagamento por tenant

Hoje o Asaas é global (uma `ASAAS_API_KEY`). Mudar para:
- Cada tenant grava sua própria credencial em `empresa_config.gateway_credentials` (criptografado via pgsodium ou via Edge Function que usa Vault)
- Edge Function `asaas/*` lê a credencial do tenant chamador (pelo `organization_id` do JWT) em vez da env global
- O Asaas master (para cobrar mensalidade dos tenants) continua em env separada `PLATFORM_ASAAS_API_KEY`

## 7. Usuários e Fornecedores

- **Usuários**: já existe `/equipe`. Adicionar limite por plano (`max_users`) bloqueando convite ao atingir
- **Fornecedores**: nova tabela `fornecedores` (nome, cnpj, contato, observações) + página `/fornecedores`, vinculável em `itens_estoque.fornecedor_id`

## 8. Entrega faseada sugerida

**Fase 1 — Fundação multi-tenant** (esta entrega):
- Migrações de schema (orgs/plans/invoices/platform_admins/empresa_config)
- Edge Function `signup-tenant` + página `/cadastro-empresa`
- Painel `/admin-master` (dashboard + lista de tenants + bloquear/desbloquear)
- Bloqueio no `ProtectedRoute` baseado em `organization.status`

**Fase 2 — Billing**:
- Planos, geração de faturas, webhook, cron de inadimplência, tela de "mensalidade em atraso"

**Fase 3 — Whitelabel completo + gateway por tenant**:
- CSS variables dinâmicas, credenciais Asaas por tenant, página `/fornecedores`, limites de plano

## Confirmações antes de começar

1. **Você quer que eu execute a Fase 1 inteira agora**, ou prefere que eu faça apenas as migrações de schema primeiro para você revisar?
2. **Cadastro público de novas empresas** deve ser aberto (qualquer um se cadastra e ganha 7 dias de trial) ou fechado (só você cria via Super Admin)?
3. **Seu gateway master** para cobrar os tenants será o Asaas (mesma conta atual numa env separada) ou outro?
4. **Quantos planos iniciais** quer cadastrar e com quais preços? (ex: Basic R$ 99, Pro R$ 199, Enterprise R$ 399)
