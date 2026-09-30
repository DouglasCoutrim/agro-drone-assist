# FASE 1 — Mapeamento Funcional do LivreOS

Data: 2026-07-31 · Escopo: 28 páginas, componentes de negócio, hooks, rotas, edge functions, políticas RLS.

---

## 1.1 — Descobertas críticas desta fase

> Todas as afirmações abaixo foram verificadas por leitura direta dos arquivos citados.

### 🔴 C1 — Isolamento multi-tenant AINDA QUEBRADO mesmo com RLS ligado

A migração `20260617115620` habilitou RLS e corrigiu só as políticas **INSERT** de `clientes` e `ordens_servico`. As políticas **SELECT/UPDATE/DELETE** das tabelas centrais continuam **role-only** (qualquer admin/técnico de qualquer org acessa os dados de todas as orgs):

| Tabela | Policy atual (nas migrations) | Origem |
|--------|-------------------------------|--------|
| `clientes` | SELECT `is_admin_or_tecnico` (sem org) | `20260304022907:5-9` |
| `clientes` | UPDATE/DELETE role-only | `20251207200702:232-240` |
| `itens_estoque` | SELECT `is_admin_or_tecnico`; ALL role-only | `20260307024917:6-8`, `20251207200702:248-251` |
| `ordens_servico` | SELECT `is_admin_or_tecnico`; UPDATE/DELETE role-only | `20260307024917:12-14`, `20251207200702:264-272` |
| `financeiro` | admin ALL; tecnico SELECT (sem org) | `20251207200702:286-294` |
| `orcamentos` | ALL/SELECT role-only | `20260311002423:21-28` |
| `rotas` | ALL/SELECT role-only | `20260311002423:45-52` |
| `movimentacoes_estoque` | SELECT role-only; INSERT role-only | `20260307024917:18-20`, `20251207200702:280-283` |
| `os_anexos` / `os_historico` | SELECT/gestão role-only | `20260307024917:24-32` |
| `empresa_config` | **SELECT `USING(true)`** — lê config de TODAS as orgs | `20260305130706:16-18` |
| `empresa_config` | admin ALL role-only (escrita cross-tenant) | `20260305130706:20-23` |

Consequências diretas no frontend (queries sem filtro de org que "confiam na RLS"):
- **`Relatorios.tsx:49-53,98`** — 5 queries (`ordens_servico`, `financeiro`, `clientes`, `itens_estoque`) sem `.eq('organization_id')` → exibe KPIs/financeiro/estoque de **todos os tenants**.
- **`Cobrancas.tsx:42`** — lista de clientes sem filtro → dropdown cross-tenant.
- **`Orcamentos.tsx:90-91`** — lista e dropdown de clientes sem filtro (orgId é carregado em `:82-83` e nunca usado).

### 🔴 C2 — `empresa_config` expõe credenciais de gateway de todos os tenants

A combinação de `SELECT USING(true)` (`20260305130706:16-18`) com as colunas de credenciais `gateway_clientes_credentials` e `gateway_credentials` (jsonb com **API keys Asaas/Mercado Pago em claro**; `20260516205740:20-23`) significa que **qualquer usuário autenticado pode ler as chaves de pagamento de todas as empresas**. Escrita cross-tenant também é possível (policy admin role-only).

### 🔴 C3 — RPCs de contagem expõem métricas de qualquer org

`count_os_current_month` / `count_active_users` são `SECURITY DEFINER` **sem `REVOKE` e sem checagem de pertencimento da org** (`20260516205740:26-36`), e são chamadas do frontend com `_org` arbitrário (`useUsageLimits.tsx:36-37`). Qualquer cliente (mesmo anônimo, já que o EXECUTE default é PUBLIC) pode enumerar nº de OS/mês e nº de usuários de qualquer organização.

### 🔴 C4 — `organizations` sem política de SELECT para membros

As migrations só criam policies de platform admin (+INSERT) em `organizations` (`20260516203159:68-74`, `20260617115620:53-56`). Com RLS habilitado, `useOrganization.tsx:64-68` (`.from('organizations').select('*')`) retornaria **nada** para usuários comuns → `organization=null` em todo o app. **Divergência com o banco vivo** (que deve ter policies manuais). A verificar na FASE 4 com acesso ao DB.

### 🔴 C5 — `rotas` não tem `organization_id` nas migrations (schema drift)

`rotas` foi criada sem a coluna (`20260311002423:31-41`) e **nenhuma migration a adiciona** (grep confirmado). Porém `Rotas.tsx:62` filtra por `organization_id` e `types.ts:922` (gerado do DB vivo) tem a coluna → o banco vivo diverge das migrations; um `supabase db reset` quebraria a página Rotas.

### 🟠 C6 — `user_permissions` (admin cross-tenant + sem trigger)

- A policy "Admins can manage all permissions" é role-only (`20260413030443:8-12`), sem org → admin de um tenant altera permissões de qualquer outro.
- O trigger `handle_new_user_permissions` **nunca foi criado** (função existe em `20260305123058:27-39`, mas nenhuma migration cria o `CREATE TRIGGER`). Usuários novos ficam sem linha → `usePermissions.tsx:37-40` (fail-open) concede OS/Estoque por default.

### 🟠 C7 — Bugs funcionais confirmados

| Bug | Evidência |
|-----|-----------|
| `Deslocamentos.tsx` é **100% mock** — nada é persistido | nenhuma chamada `.from()` no arquivo; state local (`:25-28`, `:103-121`) |
| `EmpresaConfig.tsx`: campos taxa_bancada/prazo_diagnostico/garantia **nunca persistidos** | `:70` desestrutura e descarta; `:54-56`/`:100-102` resetam p/ `""` |
| `create-subscription-checkout` usa `supabase.auth.getClaims(token)` (`:19`) — getClaims não recebe token e lê a sessão do cliente (edge sem sessão) → checkout provavelmente retorna Unauthorized no runtime | `supabase/functions/create-subscription-checkout/index.ts:19` |
| `Landing.tsx` planos vazios para visitantes deslogados | `:58-60` + policy `subscription_plans` `TO authenticated` (`20260516203159:39-40`) |
| Logout por inatividade não dispara | `useInactivityLogout.ts:40-45` chama `reset()` em vez de deslogar; `:94` `visibilitychange` reseta o timer |
| Rotas `/relatorios`, `/clientes`, `/servicos`, `/suporte`, `/notificacoes`, `/wiki` sem role/permission — papel `consulta` acessa dados financeiros agregados | `App.tsx:105-120` |
| Conversão de orçamento → OS insere `ordens_servico` sem `organization_id` | `Orcamentos.tsx:153-163` (+ policy INSERT org-scoped `20260617115620:31-34` → falha ou OS invisível) |
| `Clientes.tsx:66` verificação de duplicidade CPF/CNPJ sem filtro de org → falso positivo entre tenants | `Clientes.tsx:66` |
| Delete de usuário não remove `auth.users` (comentário de cascade incorreto) | `Configuracoes.tsx:120-122`, `Equipe.tsx:98-100` |
| Senha inicial em texto claro no body da edge function | `Equipe.tsx:121` → `create-user/index.ts:55` |
| `useFeatureAccess.tsx:30-32` — plano desconhecido (ex.: `basic`/`trial`) cai em bronze silenciosamente; lookup null → features vazias | `useFeatureAccess.tsx:30-38` |

---

## 1.2 — Mapa de módulos

```mermaid
flowchart TB
  subgraph Publico["Público"]
    Landing["/landing"] -->|site_config, subscription_plans| DB
    Cadastro["/cadastro-empresa"] -->|signup-tenant| EF
    ResetPwd["/reset-password"] -->|auth API| SupabaseAuth
  end

  subgraph Autenticacao["Autenticação"]
    AuthPg["/auth"] --> useAuth["useAuth (Supabase)"]
    AdminAuth["/admin/login"] -.hardcoded creds + admin_bypass.- ProtectedRoute
    ProtectedRoute -->|role/permission/feature| Pages
  end

  subgraph Operacao["Operação"]
    OS["OrdensServico"] -->|ordens_servico, itens_os, os_historico, os_anexos, financeiro| DB
    Orc["Orcamentos"] -->|orcamentos, ordens_servico, itens_os| DB
    Cli["Clientes"] -->|clientes| DB
    Cli -->|asaas-customer-sync| EF
    Est["Estoque"] -->|itens_estoque, movimentacoes_estoque| DB
    Est -->|mercadolivre, mercadolivre-import| EF
    Svc["Servicos"] -->|servicos| DB
    RotasPg["Rotas"] -->|rotas, clientes| DB
    Desl["Deslocamentos"] -.mock, nada persiste.- DB
  end

  subgraph Financeiro_["Financeiro"]
    Fin["Financeiro"] -->|financeiro| DB
    Cob["Cobrancas"] -->|asaas (list/create_payment)| EF
    Ass["Assinatura"] -->|create-subscription-checkout| EF
    Ass -->|tenant_invoices (polling)| DB
    Pay["PayButton (OS)"] -->|create-customer-charge| EF
  end

  subgraph Gestao["Gestão"]
    Eq["Equipe"] -->|profiles, user_roles, user_permissions, create-user| DB
    Conf["Configuracoes"] -->|profiles, user_roles, avatar| DB
    Emp["EmpresaConfig"] -->|empresa_config (upsert)| DB
    Emp -->|test-tenant-gateway| EF
    Rel["Relatorios"] -->|ordens_servico, financeiro, clientes, itens_estoque SEM org| DB
    Dash["Index (dashboard)"] -->|KPIs com org| DB
    Dash -->|asaas list_payments| EF
    Wiki["Wiki"] -->|wiki_categories, wiki_articles, wiki_tour_progress| DB
    Sup["Suporte"] -->|support_tickets, support_messages| DB
    Not["Notificacoes"] -->|notifications| DB
  end

  subgraph Plataforma["Plataforma (admin)"]
    AdminMaster["/admin/*"] --> Tabs
    Tabs["Overview | Tenants | Plans | Support | Broadcast | Wiki | Config | Site"]
    Tabs -->|organizations, tenant_invoices, platform_config, site_config, wiki| DB
    EF["Edge Functions"] --> DB
    genFaturas["generate-monthly-invoices (cron)"] --> EF
    checkOverdue["check-overdue-tenants (cron)"] --> EF
    wh["asaas-platform-webhook / asaas-tenant-webhook / mercadopago-webhook"] --> EF
  end

  DB[("Supabase Postgres + RLS + Storage")]
  SupabaseAuth[("Supabase Auth")]
```

---

## 1.3 — Página → Tabelas → Edge Functions (resumo)

| Página | Tabelas (leitura/escrita) | Filtro org | Edge functions | Gates |
|--------|---------------------------|-----------|----------------|-------|
| Index (dashboard) | ordens_servico, itens_estoque, clientes, financeiro | ✅ (L74-80) | `asaas` list_payments (L103) | nenhum |
| OrdensServico | ordens_servico, clientes, itens_os, os_historico, financeiro, os_anexos | ✅ (L219-220,268) | `asaas` (via PayButton) | nenhum direto |
| Orcamentos | orcamentos, clientes, ordens_servico, itens_os, profiles | ❌ leituras (L90-91) | — (PayButton→create-customer-charge) | nenhum |
| Clientes | clientes, ordens_servico (count) | ✅ (L58) / ❌ dup (L66) | `asaas-customer-sync` (L76) | nenhum |
| Estoque | itens_estoque | ✅ (L73,82,112) | `mercadolivre` (L222), `mercadolivre-import` (L276) | nenhum |
| Servicos | servicos | ✅ (L49-53) | — | nenhum |
| Financeiro | financeiro | ✅ (L48) | — | nenhum (plano bronze sem financeiro, página acessível) |
| Cobrancas | clientes (dropdown), Asaas | ❌ (L42) | `asaas` list/create (L51,67) | nenhum |
| Rotas | rotas, clientes | ✅ (L62-63) + coluna inexistente nas migrations (C5) | — | rota exige acesso_os |
| Deslocamentos | — (mock) | — | — | rota exige acesso_os |
| Relatorios | ordens_servico, financeiro, clientes, itens_estoque | ❌ (L49-53,98) | — | nenhum |
| Equipe | profiles, user_roles, user_permissions | ❌ (L50-52; RLS org p/ profiles, role-only p/ perms) | `create-user` (L117) | admin + useUsageLimits |
| Configuracoes | profiles, user_roles, storage avatars | ❌ (L58-60) | — | rota admin |
| EmpresaConfig | empresa_config | ✅ (useEmpresaConfig) | `test-tenant-gateway` (via IntegracoesFinanceiras L149) | rota admin |
| Assinatura | tenant_invoices (polling) | ✅ (RLS) | `create-subscription-checkout` (L41) | rota admin + allowBlocked |
| Wiki | wiki_categories, wiki_articles, wiki_tour_progress | n/a (global) | — | auth |
| Suporte | support_tickets, support_messages | ✅ (RLS org) | — | auth |
| Notificacoes | notifications | ✅ (RLS user) | — | auth |
| Landing | site_config, subscription_plans | n/a | — | público |
| CadastroEmpresa | subscription_plans, (via signup-tenant) | n/a | `signup-tenant` (L42) | público |
| Auth / ResetPassword | auth.* | n/a | — | público |
| MensalidadeAtraso | tenant_invoices | ✅ (L16-21) | — | allowBlocked |
| AdminMaster + 8 tabs | organizations, tenant_invoices, platform_admins, site_config, wiki, support, platform_config | platform admin | várias (broadcast/notify) | requiredPlatformAdmin |

---

## 1.4 — Matriz RLS efetiva (estado nas migrations)

| Tabela | Escopo atual nas migrations | Status |
|--------|------------------------------|--------|
| produtos, servicos, itens_os | org-scoped (SELECT + ALL) | ✅ |
| profiles | próprio + admin org-scoped + platform admin | ✅ |
| user_roles | próprio + admin org-scoped + platform admin | ✅ |
| user_permissions | próprio + **admin role-only (cross-tenant)** | ❌ |
| clientes, itens_estoque, ordens_servico | SELECT/UPDATE/DELETE **role-only (cross-tenant)**; INSERT org | ❌ |
| movimentacoes_estoque, os_anexos, os_historico | role-only (append-only p/ audit) | ❌ |
| financeiro | role-only | ❌ |
| orcamentos, rotas | role-only | ❌ |
| empresa_config | **SELECT USING(true)** + admin role-only | ❌❌ |
| organizations | platform admin + INSERT; **sem SELECT p/ membros** | ❌ (C4) |
| subscription_plans | authenticated (ativos) + platform admin | ⚠️ anon não vê |
| tenant_invoices | platform admin + membros da org | ✅ |
| support_tickets / messages | org-scoped | ✅ |
| notifications | próprio + platform admin | ✅ |
| site_config | público + platform admin | ✅ |
| wiki (artigos/categorias) | publicado + platform admin | ✅ |
| platform_config (untracked) | a definir | ? |

---

## 1.5 — Divergências repo ↔ banco vivo (sinais fortes)

1. `get_user_org_id()` — usada em políticas desde `20260414183259:19`, **sem CREATE FUNCTION no repo**.
2. `rotas.organization_id` — não existe nas migrations, existe no `types.ts:922` (gerado do vivo).
3. `organizations` sem policy de SELECT p/ membros — mas o app depende disso (`useOrganization`).
4. Colunas como `ordens_servico.organization_id`, `orcamentos.organization_id`, `financeiro.organization_id` não são criadas por nenhuma migration (apesar de usadas no front e nos triggers de notificação `20260517131316:128,173,220`) — só existem no vivo.
5. Migração destrutiva e scripts manuais (`fix-missing-org-id.sql`, `reset-platform-admin.sql`, `add-platform-admin.sql`) confirmam manutenção manual do schema vivo.

> **Conclusão FASE 1**: o repositório não representa o estado do banco em produção e não é reproduzível de ponta a ponta. Auditoria das próximas fases deve assumir que o schema vivo é a fonte de verdade, e as migrations, aproximação.

---

## 1.6 — Fluxos de dados principais

**1) Cadastro de empresa (self-service):** `CadastroEmpresa.tsx:42` → `signup-tenant` (cria user via admin API → org com `plan=slug` → profile → role admin → empresa_config). Bug: `plan_slug:'basic'` (`:26`) não existe em `subscription_plans` → org nasce com `monthly_fee=0, max_users=3, max_os=100` (defaults `signup-tenant:45-47`).

**2) OS (ciclo de vida):** `OrdensServico.tsx` insere OS (`:369`, com `organization_id` herdado do perfil `:353`), itens (`:399`), status/histórico (`:511-514`), financeiro ao concluir/finalizar (`:564-569`). Downloads de PDF via `os-pdf-share.ts`/`OSPDFGenerator.ts` (client-side). Pagamento: `PayButton` → `create-customer-charge`.

**3) Orçamento → OS:** `Orcamentos.tsx:153-163` insere OS **sem `organization_id`** (falha RLS ou OS invisível); itens (`:169`) dependem do trigger `set_itens_os_org` (`20260617162416:11-25`), que por sua vez depende da OS ter org.

**4) Cobrança de assinatura:** `Assinatura.tsx:41` → `create-subscription-checkout` (getClaims issue C7) → cria `tenant_invoices` + charge Asaas (`externalReference = invoice.id`) → webhook `asaas-platform-webhook` marca paga → `check-overdue-tenants` bloqueia orgs com fatura vencida >5 dias.

**5) Cobrança de cliente final:** `PayButton` → `create-customer-charge` (Asaas, gateway da org) → `asaas-tenant-webhook` (externalReference = id da OS/orçamento) — ver achado da FASE 0: status `'finalizada'` inválido, sem idempotência, sem verificação de assinatura.

**6) Importação Mercado Livre:** `Estoque.tsx:276` → `mercadolivre-import` (server-side, org-scoped) ou `Estoque.tsx:222` → `mercadolivre` (dados públicos).

**7) Notificações:** triggers de DB (OS, estoque baixo, suporte, faturas) gravam em `notifications` (`20260517131316:116-230`) → `NotificationBell`/`Notificacoes` leem por `user_id`.

---

## 1.7 — Próximos passos

- **FASE 2 (caça a bugs):** priorizar validação dos itens C1-C7 em runtime/DB, mapear fluxos de OS em detalhe (status, financeiro, anexos), e confirmar os bugs da FASE 0 (webhooks, enums, planos).
- **FASE 4 (segurança):** revalidar RLS contra o **banco vivo** (não só migrations); decidir política de `organizations`, `empresa_config`, RPCs; tratar `admin_bypass`.
- Decisão pendente para FASE 3/6: confirmar se o banco vivo está acessível (`supabase db` / connection string) para validar divergências da seção 1.5.
