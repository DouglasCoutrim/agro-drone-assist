# FASE 3 — Dados, Perfis e Acessos

Data: 2026-07-31 · Escopo: identidade (`profiles`, `user_roles`, `user_permissions`, `organizations`, `platform_admins`, `subscription_plans`, `tenant_invoices`), triggers, RLS de acesso e divergências repo↔banco vivo.

---

## 3.1 — Descobertas críticas desta fase

> Todas as afirmações abaixo foram verificadas por leitura direta dos arquivos citados.

### 🔴 D1 — `organizations` NUNCA é criada nas migrations (base só no banco vivo)

A tabela-base `organizations` (id, name, slug, owner_id, created_at, active, settings, telefone) **não tem `CREATE TABLE` em nenhuma migration**. As migrations só fazem `ALTER TABLE public.organizations`:

- `20260516203159:56-65` (plan, status, trial, mensalidade, limites)
- `20260516205740:11-13` (billing_cycle, cycle_discount)
- `20260517121327:3-7` (plan_id, is_vip, expires_at, subscription_status)

O esquema vivo completo (22 colunas, `types.ts:639-664`) **nunca seria reproduzido** por `supabase db reset`: a primeira ALTER em `20260516203159:56` falha com *relation "organizations" does not exist*. A base foi criada à mão no dashboard.

### 🔴 D2 — `get_user_org_id()` é usada em +20 políticas mas NUNCA é definida nas migrations

Referenciada em policies a partir de `20260414183259:19` (produtos), em `20260516203159:104`, `20260516205740:29,35`, `20260517121327:30,35,42,76,88`, `20260516210413`, `20260617115620:29,34,42,50` — e **nenhuma migration define a função**. Ela existe apenas no banco vivo (criada manualmente). Um `db reset` falharia na primeira policy que a referencia, além de quebrar o isolamento multi-tenant.

### 🔴 D3 — `profiles.organization_id` nunca é adicionada nas migrations

`profiles` nasce sem a coluna (`20251207200702:14-21`); nenhuma migration faz `ADD COLUMN organization_id`. No entanto ela é escrita pelas edge functions `signup-tenant/index.ts:75` e `create-user/index.ts:91`, e lida por `useOrganization.tsx:56-60`. → mais um item **só-vivo**, não reproduzível.

### 🔴 D4 — Credenciais do portal admin hardcoded no frontend

`src/pages/AdminAuth.tsx:15-18`:

```ts
const ADMIN_CREDENTIALS = {
  username: "douglas",
  password: "#Va_Ds12",
};
```

A senha do "portal administrativo" está em **texto claro no bundle JS**. Qualquer pessoa (usuário de um tenant, concorrente) pode abrir o JS minificado do site e extraí-la. Junto com D5, o portal admin não exige nada além dessa senha pública.

### 🔴 D5 — Bypass de admin é um flag de localStorage

- `AdminAuth.tsx:53` — ao digitar a senha, grava `localStorage.admin_bypass = 'true'`.
- `ProtectedRoute.tsx:23-26` — com o flag, libera **todas** as rotas `/admin/*` sem verificar o usuário autenticado.
- `useOrganization.tsx:27-32` — com o flag, trata o visitante como `isPlatformAdmin`.
- `PlatformSidebar.tsx:42-48` — logout apenas limpa o flag.

O "super admin" da plataforma é **um flag de cliente**, não uma sessão server-side. (As tabelas de dados ainda têm RLS, então o vazamento de leitura é limitado ao que a RLS permite — mas o modelo de acesso está quebrado por construção.)

### 🟠 D6 — RLS de perfis/roles/permissões: corrigido para org, mas `user_permissions` segue role-only

`20260516210413` **droppou** as policies role-only de `profiles` e `user_roles` e criou versões org-scoped:

| Tabela | Situação | Origem |
|--------|----------|--------|
| `profiles` | ✅ Admin policies org-scoped (`has_role(admin)` **AND** `organization_id = get_user_org_id`) | `20260516210413:7-26` (substitui `20251207200702:195-198`) |
| `user_roles` | ✅ Admin policies org-scoped (`get_user_org_id(user_id) = get_user_org_id(auth.uid())`) | `20260516210413:29-61` (substitui `20251207200702:216-219`) |
| `user_permissions` | ❌ **Ainda role-only**: "Admins can manage all permissions" `FOR ALL USING has_role(admin)` — **admin de um tenant altera permissões de usuários de qualquer org** | `20260305123058:22-24` |

> Atenção: a correção de `20260516210413` depende de `profiles.organization_id` e de `get_user_org_id()` — **itens que não existem nas migrations** (D1-D3). Ou seja, o isolamento existe só no banco vivo; em `db reset` a própria correção falharia.

### 🟠 D6b — RLS das tabelas de negócio continua role-only (cross-tenant)

`clientes`, `ordens_servico`, `itens_estoque`, `financeiro`, `orcamentos`, `rotas`, `movimentacoes_estoque`, `os_anexos`, `os_historico` mantêm policies **sem filtro de org** (FASE-1 C1): qualquer admin/técnico acessa os dados de todas as orgs (`20251207200702:222-316`, `20260304022907:5-9`, `20260307024917:6-32`, `20260311002423:21-28,45-52`). `empresa_config` tem `SELECT USING(true)` (`20260305130706:16-18`).

### 🟠 D7 — Trigger `handle_new_user_permissions` órfã (fail-open)

`20260305123058:27-39` cria a função, mas **nenhuma migration cria o `CREATE TRIGGER`** em `auth.users`. Usuários novos ficam **sem linha** em `user_permissions` → `usePermissions.tsx:37` cai no default `{ acesso_os: true, acesso_estoque: true, acesso_financeiro: false }` e `:40` idem no catch. O gate de módulos **concede OS/Estoque por omissão** a todo usuário novo.

### 🟠 D8 — `organizations` sem política de SELECT para membros nas migrations

Com RLS habilitado em `20260617115620:13`, as únicas policies de `organizations` no repo são de platform admin (`20260516203159:68-74`, `20260521170618:4-5`) e INSERT (`20260617115620:53-56`). **Nenhuma policy SELECT para membros** → `useOrganization.tsx:64-68` (`.from('organizations').select('*')`) retornaria **nada** para não-admins → `organization = null` em todo o app. O banco vivo deve ter policies manuais adicionadas (a confirmar com acesso ao DB).

### 🟠 D9 — Migration destrutiva `20260618123536`

`20260618123536:2-28` faz `TRUNCATE` de **23 tabelas** (incl. `ordens_servico`, `financeiro`, `clientes`, `profiles`, `organizations`) + `DELETE FROM auth.users`. Se rodada num banco com dados, **apaga tudo sem recover**. É um reset de produção travestido de migration — não deveria existir no histórico de migrations de um projeto com clientes.

### 🟠 D10 — SQL manual fora das migrations

`supabase/fix-missing-org-id.sql`, `supabase/add-platform-admin.sql`, `supabase/reset-platform-admin.sql` — a equipe executa SQL solto no dashboard em vez de migrations versionadas. Isso explica (e agrava) o drift D1-D3 e impede a reprodução.

---

## 3.2 — Fluxo de identidade (como deveria ser vs. o que está no repo)

```mermaid
flowchart LR
  A["auth.users"] -->|trigger handle_new_user<br/>20251207200702:319-343| B["profiles (role consulta)<br/>user_roles (consulta)"]
  B -->|signup-tenant:79-80| C["user_roles → admin"]
  B -->|create-user:96-100| D["user_roles → role escolhida"]
  B -.x|trigger handle_new_user_permissions<br/>NUNCA criado| E["user_permissions"]
```

- O trigger de criação de perfil existe e funciona (`20251207200702:342-343`).
- O trigger de permissões **nunca é criado** (D7) → dependência de fail-open no front.
- `get_user_role()` (`20251207200702:163-173`) faz `LIMIT 1` sem `ORDER BY`; com múltiplos papéis o resultado é ambíguo (e `useAuth.tsx:29-39` usa `maybeSingle()` — falha/undefined com múltiplos).
- `platform_admins` é separada (`20260516203159:3-22`), mas o portal admin frontend ignora a tabela e usa a senha hardcoded (D4/D5).

---

## 3.3 — Divergências repo ↔ banco vivo (itens só-vivos)

| Item | Só no banco vivo | Referenciado em |
|------|------------------|-----------------|
| **Coluna `organization_id` em TODAS as tabelas de negócio** (`clientes`, `ordens_servico`, `itens_estoque`, `financeiro`, `orcamentos`, `rotas`, `movimentacoes_estoque`, `os_anexos`, `os_historico`, `profiles`, `empresa_config`, `organizations`) | ✅ — **nenhuma migration faz `ADD COLUMN organization_id`** (grep em todos os `*.sql` retornou 0 matches) | policies RLS desde `20260414183259` e `20260617115620:29,34` |
| Tabela `organizations` (base) | ✅ | `20260516203159:56` + `types.ts:639-664` |
| `profiles.organization_id` | ✅ | `signup-tenant:75`, `create-user:91`, `useOrganization:56-60` |
| Função `get_user_org_id()` | ✅ | +20 policies |
| `rotas.organization_id` | ✅ | `Rotas.tsx:62`, `types.ts:922` (FASE-1 C5) |
| Policy SELECT de org p/ membros | ✅ (presumido) | `useOrganization:64-68` (sem ela, app quebra) |
| `status_os` (13 valores) | ✅ | `20260307022216:3-9` (adições em migration — **ok**) |

> **Consequência maior da auditoria:** a camada inteira de isolamento multi-tenant (RLS org-scope) depende de colunas e função que **o repo não cria**. O repositório é uma "casca" que só funciona no banco vivo; `supabase db reset` falha na primeira policy que referencia `organization_id`/`get_user_org_id` (ex.: `20260617115620:29`).
>
> Item marcado "presumido": o repo não tem a policy, então ou o app está quebrado ou o vivo tem policy manual. Confirmar com acesso ao DB.

---

## 3.4 — Integridade e outros achados

| Item | Evidência |
|------|-----------|
| `tenant_invoices.organization_id` sem FK para `organizations` | `20260516203159:82` |
| FK `ordens_servico.cliente_id` alterada para `ON DELETE CASCADE` — deletar cliente apaga as OSs dele | `20260617160522:1-2` |
| `subscription_plans` seed inconsistente: cria `basic/pro/enterprise` (`20260516203159:50-53`) e logo depois `DELETE` + bronze/prata/ouro (`20260516205740:3-8`) | — |
| Plano `'basic'` ainda usado no fluxo de signup (`CadastroEmpresa.tsx:26`, `signup-tenant:42`) apesar de não existir | FASE-1 C7 / FASE-2 E6 |
| `subscription_plans` policy SELECT `TO authenticated` → páginas públicas (Landing, Cadastro) com lista de planos vazia | `20260516203159:39-40` |
| `notifications`: sem policy INSERT para usuários (só SELECT/UPDATE/DELETE próprias + platform admin ALL); inserção só via triggers `SECURITY DEFINER` | `20260517131316:22-37` |
| Realtime habilitado para `notifications` com `REPLICA IDENTITY FULL` | `20260517131316:40-41` |
| `empresa_config.organization_id` só vira `NOT NULL` em `20260618121443:1` (antes, registros órfãos possíveis) | FASE-1 |
| RPCs `count_os_current_month`/`count_active_users` SECURITY DEFINER sem REVOKE (EXECUTE público) | `20260516205740:26-36` (FASE-1 C3) |

---

## 3.5 — Validação em runtime pendente

1. Confirmar a policy SELECT de membros em `organizations` no vivo (D8).
2. Confirmar a definição de `get_user_org_id()` no vivo (comportamento de `has_role` etc.).
3. Confirmar se `handle_new_user_permissions` foi criada manualmente no vivo (ou se todos os usuários dependem do fail-open).
4. Confirmar se a migration destrutiva `20260618123536` já foi aplicada em algum ambiente com dados.
