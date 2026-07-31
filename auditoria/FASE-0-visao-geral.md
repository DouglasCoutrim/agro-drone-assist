# FASE 0 — Visão Geral do Repositório `agro-drone-assist` (LivreOS)

Data: 2026-07-31 · Auditor lido de fato: sim (todos os 39 migrations, 16 edge functions, estrutura completa do frontend)

---

## 0.1 — Achados críticos (resumo antecipado, detalhados ao longo do relatório)

> O usuário pediu que os itens 🔴 CRÍTICOS fiquem no topo. Detalhes com arquivo:linha em cada seção.

| # | Severidade | Achado | Localização |
|---|-----------|--------|-------------|
| 1 | 🔴 CRÍTICO | **RLS esteve DESATIVADO em todas as tabelas multi-tenant até 17/06/2026** — vazamento de dados entre tenants era possível (leitura/escrita de dados de outras empresas pelo banco). | `supabase/migrations/20260617115620_8a99b786-...sql` (linhas 1-3 e 5-21) |
| 2 | 🔴 CRÍTICO | **Login "admin" com credenciais HARDCODED no frontend** + bypass por `localStorage.admin_bypass` que libera o painel de plataforma sem nenhuma autenticação real. | `src/pages/AdminAuth.tsx:15-18,49-53` · `src/components/ProtectedRoute.tsx:23-26` · `src/hooks/useOrganization.tsx:26-32` |
| 3 | 🔴 CRÍTICO | **Senha hardcoded e fixada por edge function** `seed-platform-admin` ("98751344@") que cria/reescreve a senha do admin da plataforma e **retorna a senha na resposta HTTP**. | `supabase/functions/seed-platform-admin/index.ts:12-13,34,50` |
| 4 | 🔴 CRÍTICO | **Webhooks sem verificação de autenticidade** (`verify_jwt = false` e sem assinatura): qualquer pessoa pode forjar pagamentos e alterar status de OS/orçamentos/faturas. | `supabase/config.toml` · `supabase/functions/asaas-tenant-webhook/index.ts:21-27` · `asaas-platform-webhook/index.ts` · `mercadopago-webhook/index.ts` |
| 5 | 🔴 CRÍTICO | **Edge function `test-tenant-gateway` sem qualquer autenticação** — qualquer anônimo pode testar credenciais Asaas/Mercado Pago contra APIs externas. | `supabase/functions/test-tenant-gateway/index.ts` |
| 6 | 🔴 ALTO | **Migração destrutiva versionada**: `TRUNCATE` em todas as tabelas de negócio + `DELETE FROM auth.users`. Se aplicada (ex.: `supabase db push` em produção), **apaga todos os dados e usuários**. | `supabase/migrations/20260618123536_89e63043-...sql` |
| 7 | 🔴 MÉDIO-ALTO | **`.env` versionado no git** contendo chave do Supabase. | `.env` (listado em `git ls-files`) |
| 8 | 🟠 MÉDIO | **Bug de faturamento**: plano `basic` não existe no banco (só bronze/prata/ouro), mas o cadastro manda `plan_slug: 'basic'` e a edge function faz lookup de `'basic'` → plano não encontrado → fee 0 e limites default. | `src/pages/CadastroEmpresa.tsx:26` · `supabase/functions/signup-tenant/index.ts:38-47` |
| 9 | 🟠 MÉDIO | **Bug de enum**: segmento "mobilidade" usa `dbEnum` que não existe no enum `tipo_equipamento` (ex.: `patinete_eletrico`) → INSERT de OS falharia. | `src/lib/equipment-segments.ts:34-39` · `src/pages/OrdensServico.tsx:1095-1096` |
| 10 | 🟠 MÉDIO | **Migrations não reproduzíveis**: função `public.get_user_org_id()` é usada em políticas RLS desde 14/04/2026 mas **não há nenhum `CREATE FUNCTION` dela no repo** (deve existir apenas no banco vivo). `supabase db reset` em ambiente novo falharia. | `supabase/migrations/20260414183259_...sql:19` e outras; busca por definição sem resultado |

---

## 0.2 — Stack

| Camada | Tecnologia | Evidência |
|--------|-----------|-----------|
| Frontend | Vite + React 18 + TypeScript | `vite.config.ts`, `package.json` |
| UI | Tailwind CSS + shadcn/Radix UI (`src/components/ui/*`) + recharts (`chart.tsx`) | `tailwind.config.ts`, `components.json` |
| Router | React Router | `src/App.tsx` |
| Estado/dados | TanStack Query + contextos próprios (`src/hooks/*`) | `package.json` |
| Backend | **Supabase** — Postgres, Auth, Storage (buckets `os-anexos`, `avatars`, `wiki-media`), Realtime, Edge Functions (Deno) | `src/integrations/supabase/*`, `supabase/functions/*`, `supabase/config.toml` |
| Integrações externas | Asaas (cobrança PIX/boleto), Mercado Pago (webhook), Mercado Livre (import via API pública), ViaCEP (CEP), WhatsApp (links `wa.me`) | `supabase/functions/asaas*`, `mercadopago-webhook`, `mercadolivre*`, `src/hooks/useViaCep.tsx`, `src/lib/whatsapp-templates.ts` |
| PDF | Client-side via html2canvas + jsPDF | `src/lib/os-pdf-share.ts`, `src/lib/orcamento-pdf.ts`, `src/components/ordens-servico/OSPDFGenerator.ts` |
| Gerenciador de pacotes | **Dois lockfiles convivem**: `package-lock.json` e `bun.lock`/`bun.lockb` — risco de drift | raiz |
| Testes | **Nenhum** (sem vitest/jest/cypress; scripts apenas dev/build/lint/preview) | `package.json` |
| CI/CD | Nenhuma config de CI encontrada | — |

---

## 0.3 — Estrutura do repositório

```
agro-drone-assist/
├─ .env                          # versionado (anon key do Supabase)
├─ package.json / package-lock.json / bun.lock / bun.lockb
├─ vite.config.ts / tailwind.config.ts / tsconfig*.json / eslint.config.js / postcss.config.js
├─ components.json               # shadcn
├─ public/                       # manifest.json (PWA), ícones, favicons
├─ .lovable/plan.md              # plano Lovable (app gerado via Lovable)
└─ src/
   ├─ App.tsx / main.tsx / index.css
   ├─ pages/        (28 páginas) Auth, AdminAuth, AdminMaster, CadastroEmpresa, ResetPassword,
   │                 Index (dashboard), OrdensServico, Orcamentos, Clientes, Estoque, Servicos,
   │                 Financeiro, Cobrancas, Relatorios, Rotas, Deslocamentos, Equipe,
   │                 Configuracoes, EmpresaConfig, Assinatura, Wiki, Suporte, Notificacoes,
   │                 MensalidadeAtraso, Landing, NotFound
   ├─ components/
   │   ├─ ui/          (~50 shadcn primitives incl. custom: smart-select, catalog-autocomplete,
   │   │               number-input, searchable-input, help-tooltip)
   │   ├─ admin/       OverviewTab, PlansTab, SupportTab, BroadcastTab, WikiTab, SiteTab,
   │   │               ConfigTab, TenantsTab   (painel da plataforma)
   │   ├─ layout/      MainLayout, Sidebar, PlatformSidebar, Header, MobileHeader, BottomNav
   │   ├─ os/          StatusPipeline, OSItemsSection, PaymentConfirmDialog, QuickClientModal,
   │   │               LegalTermsFooter, EmptyState
   │   ├─ ordens-servico/  OSPDFGenerator.ts
   │   ├─ dashboard/   KpiCard, StatsCard
   │   └─ raiz: ProtectedRoute, PayButton, UpgradePlanModal, NotificationBell, GlobalSearch,
   │            CsvImportExport, IntegracoesFinanceiras, ThemeToggle
   ├─ hooks/       (15) useAuth, useOrganization, usePermissions, useFeatureAccess, useUsageLimits,
   │               useEmpresaConfig, useOrgSegments, useTeamMembers, useNotifications, useViaCep,
   │               useTheme, useConfirm, useInactivityLogout, use-mobile, use-toast
   ├─ lib/         constants, formatters, utils, equipment-segments, whatsapp-templates,
   │               os-pdf-share, orcamento-pdf
   └─ integrations/supabase/  client.ts, types.ts (tipos gerados)
└─ supabase/
   ├─ config.toml               # projeto Supabase local
   ├─ .temp/cli-latest
   ├─ add-platform-admin.sql / reset-platform-admin.sql / fix-missing-org-id.sql   # scripts manuais
   ├─ migrations/  (39 arquivos, 2025-12-07 → 2026-07-31; o último é untracked)
   └─ functions/   (16 edge functions Deno)
```

---

## 0.4 — Modelo de dados (linha do tempo das migrations)

Linha do tempo completa — **39 migrations**, de app single-tenant para SaaS multi-tenant:

### Fase 1 — Single-tenant (2025-12-07)
- `20251207200702` (base): enums `app_role (admin|tecnico|consulta)`, `tipo_equipamento (drone_agricola|drone_convencional|controle|bateria|outro)`, `status_os`, `tipo_transacao (receita|despesa|salario|comissao)`.
  Tabelas: `profiles`, `user_roles`, `clientes`, `itens_estoque`, `ordens_servico`, `movimentacoes_estoque`, `financeiro`, `os_anexos`, `os_historico`.
  Funções RLS: `has_role` (L149), `get_user_role` (L163), `is_admin_or_tecnico` (L176); triggers `handle_new_user` (L319), `update_updated_at_column` (L346), `generate_os_number` (L374, numeração `YYYY-00001`).
  **Tabelas SEM `organization_id`** — era um sistema de oficina única.
- `20251207200816`: corrige `search_path` das funções acima.

### Fase 2 — Perfis/permissões/config da empresa (2026-03)
- `20260304022907`: ajustes iniciais de perfis/acesso.
- `20260305123058`: tabela `user_permissions` (acesso_os/acesso_estoque/acesso_financeiro) + trigger `handle_new_user_permissions` (L27).
- `20260305130706`: tabela `empresa_config` (nome_empresa, cnpj, telefone, responsavel…) com default "Ares Agrotec".
- `20260305132841`: políticas "Admins can insert/delete profiles".
- `20260307022216`: **expande `status_os`** (ADD VALUE: recebido, aguardando_diagnostico, aguardando_aprovacao, aprovado, em_reparo, em_testes, pronto_retirada) (L3-9); colunas profissionais na OS.
- `20260307024917`: restringe políticas SELECT.
- `20260307030630`: bucket de storage `avatars`.
- `20260311002423`: `orcamentos`, `rotas`, campos de ciclos de carga em itens.
- `20260317010758`: ajustes de integração/estoque.

### Fase 3 — Início do multi-tenant (2026-04/05)
- `20260413025634`: `empresa_config.termos_servico` (texto de T&C default).
- `20260413030443`: corrige políticas de `user_permissions` e `user_roles`.
- `20260413082636`: restringe SELECT no bucket `os-anexos` à mesma org; **append-only** em `movimentacoes_estoque` e `os_historico` (deny UPDATE/DELETE).
- `20260414183259`: **cria `produtos`, `servicos`, `itens_os` JÁ com `organization_id` (FK → organizations)** e políticas com `get_user_org_id(auth.uid())` — primeira referência a essa função (ver achado #10). `itens_os` liga serviços/produtos à OS.
- `20260415042610`: coluna `vendedor_id`.
- `20260513124452`: descontos em `orcamentos` (desconto/itens) e `ordens_servico.desconto`.

### Fase 4 — SaaS/plataforma (2026-05-16 em diante)
- `20260516203159`: **núcleo multi-tenant**: `is_platform_admin()` (L9), `platform_admins`, `subscription_plans`, `organizations`, `tenant_invoices` + políticas scoped por org.
- `20260516203757`: planos `basic/pro/enterprise` (depois **deletados** e substituídos).
- `20260516205740`: **planos bronze/prata/ouro**; `organizations` billing_cycle/cycle_discount; `empresa_config.gateway_clientes` (credenciais Asaas/MP **em JSONB em claro**); RPCs `count_os_current_month` (L26) e `count_active_users` (L33).
- `20260516210413`: políticas org-scoped para `profiles`/`user_roles` (is_platform_admin ou mesma org).
- `20260517121327`: `organizations.plan_id/is_vip/expires_at/subscription_status`; `support_tickets`; tabelas da **wiki**.
- `20260517131316`: **notificações**: funções `notify_user/notify_org_role/notify_org_all/notify_broadcast_global/notify_broadcast_org` (L46-114), triggers `trg_notify_os_changes` (L116), `trg_notify_estoque_baixo` (L167), `trg_notify_support_reply` (L190), `trg_notify_tenant_invoice` (L215); bucket `wiki-media` com políticas só para platform admin (L316-324).
- `20260521` (6 migrations): `wiki_tour_progress`; policies de platform admin em ~16 tabelas (`20260521170618` L5-65); plataforma: **seed de `platform_admins` com e-mail `douglascoutrim@outlook.com`** (`20260521170903`); `site_config` + conteúdo inicial da wiki.

### Fase 5 — Correções de segurança/dados (2026-06)
- `20260617115620`: **🔴 ENABLE ROW LEVEL SECURITY** em 18 tabelas + recria políticas INSERT com WITH CHECK scoped (ver achado #1).
- `20260617132344`: dedupe de `empresa_config`.
- `20260617154454/17154528`: grants e política de platform admin em `itens_os`.
- `20260617160522`: FK `ordens_servico.cliente_id` → `clientes(id) ON DELETE CASCADE`.
- `20260617162416`: backfill `itens_os.organization_id` a partir da OS pai + trigger `set_itens_os_org` (SECURITY DEFINER).
- `20260618121443`: `empresa_config.organization_id` NOT NULL.
- `20260618123536`: **🔴 TRUNCATE de todas as tabelas de negócio + DELETE auth.users** (ver achado #6).

### Fase 6 — Atual (2026-07)
- `20260731103406` (**untracked no git**): tabela `platform_config` (usada por `src/components/admin/ConfigTab.tsx`, que está modificado sem commit).

---

## 0.5 — Modelo multi-tenant e nichos

### Multi-tenancy
- **Um único banco Postgres.** Tenant = linha em `organizations`.
- Tenantificação por **linha**: `profiles.organization_id` e coluna `organization_id` em todas as tabelas de negócio (adicionadas aos poucos a partir de abril/2026).
- Isolamento via **RLS** com helpers:
  - `has_role(uid, app_role)` — base `20251207200702:149`
  - `get_user_role(uid)` — base `:163`
  - `is_admin_or_tecnico(uid)` — base `:176`
  - `is_platform_admin(uid)` — `20260516203159:9`
  - `get_user_org_id(uid)` — **referenciada em políticas desde `20260414183259:19` mas sem definição no repo** (achado #10)
- Papéis por org: `admin` > `tecnico` > `consulta`; permissões de módulo em `user_permissions` (acesso_os, acesso_estoque, acesso_financeiro). No frontend, `ProtectedRoute.tsx:53-98` aplica hierarquia e permissões.
- **Bloqueio por inadimplência**: `organizations.status='blocked'` + página `MensalidadeAtraso`; `ProtectedRoute.tsx:48-50` redireciona (platform admin escapa).
- **Limites por plano**: RPCs `count_os_current_month`/`count_active_users` + `useUsageLimits.tsx` + `UpgradePlanModal.tsx`.

> ⚠️ **Ponto crítico de confiança**: o isolamento só passou a ser realmente efetivo em 17/06/2026 (RLS on). Antes disso, políticas org-scoped existiam mas não eram aplicadas. Na prática, durante meses qualquer usuário autenticado podia ler/gravar dados de qualquer tenant.

### Nichos
- **Sem tabelas por nicho.** Nichos são configurados por tenant em `organizations.settings` (jsonb: `segmentos`, `tipos_custom`) — lidos por `src/hooks/useOrgSegments.tsx`.
- Catálogo global de segmentos/tipos em `src/lib/equipment-segments.ts` (`SEGMENTOS`: drones, mobilidade, informatica, bicicletas…).
- Tipos específicos fora do enum são salvos como `tipo_equipamento='outro'` com label preservada no front (SmartSelect/catalog-autocomplete).
- **Problema confirmado**: no segmento `mobilidade`, `equipment-segments.ts:34-39` define `dbEnum: 'patinete_eletrico'/'bicicleta_eletrica'/'moto_eletrica'/'outros_autopropelidos'`, que **não existem** no enum (que nunca foi alterado — grep por `ALTER TYPE ... tipo_equipamento` sem resultados). `OrdensServico.tsx:1095-1096` usa `dbEnum` direto no INSERT → falha de enum ao abrir OS de patinete/bicicleta/moto.

---

## 0.6 — Autenticação e RLS

### Fluxos de login
1. **Usuário da oficina**: `src/pages/Auth.tsx` — email/senha via Supabase Auth (`signInWithPassword`); redireciona platform admin para `/admin/dashboard`.
2. **Cadastro self-service**: `src/pages/CadastroEmpresa.tsx` → edge function `signup-tenant` (cria usuário + org + role admin + empresa_config).
3. **🔴 "Portal Administrativo"**: `src/pages/AdminAuth.tsx` — **não usa Supabase**. Compara com `ADMIN_CREDENTIALS` hardcoded (`"douglas"`/`"#Va_Ds12"`, L15-18) e grava `localStorage.admin_bypass = "true"` (L53).
   - `src/components/ProtectedRoute.tsx:23-26`: se `admin_bypass==='true'`, libera rotas `requiredPlatformAdmin` (todo o painel `/admin/*`) **sem nenhum usuário/check de backend**.
   - `src/hooks/useOrganization.tsx:26-32`: o bypass também marca `isPlatformAdmin=true` globalmente.
   - Consequência: **qualquer pessoa que digite `localStorage.setItem('admin_bypass','true')` no console tem acesso total ao painel de plataforma** (tenants, planos, broadcast, config global com chaves de gateway).

### RLS (estado atual)
- RLS habilitado (18 tabelas) desde `20260617115620`. Políticas principais:
  - Leitura/escrita de dados de negócio: `organization_id = get_user_org_id(auth.uid())` + `is_admin_or_tecnico`.
  - `profiles`/`user_roles` admin: mesma org ou platform admin (`20260516210413`).
  - `organizations`: leitura própria (via perfil) ou platform admin; INSERT `owner_id = auth.uid()` (`20260617115620:53-56`).
  - Platform admins têm políticas FOR ALL em ~16 tabelas (`20260521170618`) — inclui `empresa_config` (onde ficam chaves de gateway) e `platform_config`.
  - Tabelas `notifications`, `support_tickets`, `wiki_*`: policies próprias (wiki pública só publicada).
- Append-only: `movimentacoes_estoque` e `os_historico` (deny UPDATE/DELETE, `20260413082636:13-22`).

---

## 0.7 — Edge Functions (16) — inventário e segurança

| Função | Papel | Segurança |
|--------|-------|-----------|
| `api` | Endpoints genéricos com service role | Valida role do usuário via claims |
| `asaas` | Operações Asaas (Bearer token) | Valida claims + `user_roles` |
| `asaas-customer-sync` | Sincroniza cliente no Asaas | Valida claims; usa `ASAAS_API_KEY` env |
| `asaas-platform-webhook` | Webhook Asaas da plataforma | 🔴 `verify_jwt=false`, sem assinatura |
| `asaas-tenant-webhook` | Webhook Asaas da oficina | 🔴 `verify_jwt=false`, sem assinatura, **status inválido** `'finalizada'` (não existe no enum), sem idempotência; `externalReference` é o próprio id da OS/orçamento → qualquer um pode forjar `PAYMENT_RECEIVED` e concluir uma OS |
| `mercadopago-webhook` | Webhook MP | 🔴 `verify_jwt=false`; varre **todas** as `empresa_config` para achar token (N+1 global); sem idempotência |
| `create-customer-charge` | Cobrança PIX do cliente final | Valida claims; org via profile; gateway da org |
| `create-subscription-checkout` | Checkout de assinatura Asaas | Valida plan_slug/cycle; service role |
| `create-user` | Admin cria usuário da org | Valida role admin |
| `generate-monthly-invoices` | Gera faturas mensais Asaas | Valida platform admin |
| `check-overdue-tenants` | Bloqueia tenants inadimplentes | Valida platform admin (uso interno/cron) |
| `mercadolivre` / `mercadolivre-import` | Importa itens do Mercado Livre | Valida claims/org; API pública + fallback de scraping |
| `signup-tenant` | Cadastro self-service | **Pública (intencional)**; ver bug do plano (achado #8) |
| `seed-platform-admin` | Seed do admin da plataforma | 🔴 senha hardcoded + retorna senha (achado #3) |
| `test-tenant-gateway` | Testa credenciais de gateway | 🔴 **sem auth** (achado #5) |

Config (`supabase/config.toml`): `verify_jwt=false` para `asaas-platform-webhook`, `asaas-tenant-webhook`, `mercadopago-webhook` — esperado para webhooks, porém **não há verificação de assinatura HMAC/secret** em nenhum deles.

---

## 0.8 — Riscos e observações complementares

- **Migrations não auto-contidas**: além do `get_user_org_id` ausente (achado #10), existem scripts manuais fora de migrations (`add-platform-admin.sql`, `reset-platform-admin.sql`, `fix-missing-org-id.sql` com dados específicos — ex.: e-mail `sara@voltmaster.com`) — indicam que o banco vivo foi corrigido à mão, divergindo do que as migrations produziriam.
- **Duplo e-mail de platform admin**: migrations seed com `douglascoutrim@outlook.com`; seed/reset scripts e `seed-platform-admin` usam `douglascoutrim@livreos.com`.
- **Chaves de gateway em texto claro**: `empresa_config.gateway_clientes` (jsonb) guarda credenciais Asaas/MP/PIX sem criptografia; expostas a qualquer platform admin via RLS.
- **`signup-tenant`** cria org com `plan: slug` (ex.: `'trial'`) e busca plano por `'basic'`; `subscription_plans` só tem bronze/prata/ouro → na prática trial cria org com `monthly_fee=0`, `max_users=3`, `max_os_per_month=100` (defaults de `signup-tenant/index.ts:45-47`).
- **`CadastroEmpresa.tsx` é público?** O form usa `RadioGroup` iterando sobre planos; a policy de `subscription_plans` exige `authenticated` ou platform admin (`20260516203159:40`) → **anon veria lista vazia**. Confirmar em FASE 2 se o self-signup funciona sem login (possível bug funcional).
- **Lockfiles duplos** (npm + bun) e sem CI — risco de build divergente entre máquinas.
- **`bun.lockb` e `package-lock.json`**: verificar qual é o fonte da verdade em FASE 1.

---

## 0.9 — Assunções e dúvidas (a confirmar nas próximas fases)

1. Se `get_user_org_id()` existe no banco vivo (não está em nenhum migration) — precisa validar em `supabase db` / console. **Assunção**: foi criada manualmente; repo não é reproduzível de ponta a ponta.
2. Se o self-signup (CadastroEmpresa) funciona para usuário anônimo, dado o RLS de `subscription_plans` (FASE 2).
3. Se os webhooks recebem `externalReference` com formato `tenant:orgId:competencia` (plataforma) vs id puro (tenant) — usado em FASE 2 para mapear fluxos de cobrança.
4. Nicho atualmente ativo dos tenants reais: o catálogo `equipment-segments.ts` cobre drones/mobilidade/informática/bicicletas, mas o enum base é só de drones — o app nasceu focado em "agro-drone".
5. `20260304022907` e `20260317010758` não foram detalhados linha a linha nesta fase (ajustes de auth/estoque) — serão cobertos na FASE 1/2 conforme necessário.

---

## 0.10 — Próximos passos

1. **FASE 1 — Mapeamento funcional**: ler as 28 páginas (incluindo `OrdensServico.tsx` ~81 KB) e componentes de negócio; produzir diagrama de módulos e fluxos de dados; corrigir dúvidas 0.9.
2. **FASE 2 — Caça a bugs**: validar bugs listados em 0.1 (especialmente #8, #9 e webhooks), testes de caixa preta no schema real se disponível.
3. **FASE 3-6**: dados/perfis/acessos, segurança (aprofundar RLS e segredos), performance/RLS N+1, integridade referencial/consistência.
4. **AUDITORIA.md** consolidado ao final, com plano de correção priorizado (críticos primeiro, conforme instrução do usuário).
