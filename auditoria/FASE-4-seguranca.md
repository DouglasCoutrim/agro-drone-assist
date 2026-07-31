# FASE 4 — Segurança

Data: 2026-07-31 · Escopo: autenticação, segredos, service role, webhooks, RLS efetiva, CORS, storage, rate limiting e reprodução de configuração.

---

## 4.1 — Descobertas críticas desta fase

> Todas as afirmações abaixo foram verificadas por leitura direta dos arquivos citados.

### 🔴 S1 — Backdoor do portal admin: credenciais hardcoded + bypass de localStorage

- `src/pages/AdminAuth.tsx:15-18` — usuário/senha do "portal administrativo" **em texto claro no código**: `douglas` / `#Va_Ds12`.
- `AdminAuth.tsx:53` — autenticação reduzida a gravar `localStorage.admin_bypass = 'true'`.
- `ProtectedRoute.tsx:23-26` — com o flag, todas as rotas `/admin/*` são liberadas **sem checar o usuário autenticado nem `platform_admins`**.
- `useOrganization.tsx:27-32` — o flag também torna o visitante `isPlatformAdmin` no app.
- `PlatformSidebar.tsx:42-48` — o "Super Administrator" é exibido sempre que o flag está setado.

**Impacto:** a "porta" de super admin é um valor de cliente modificável; a senha está no bundle JS público. Um invasor que leia o JS obtém acesso à UI de admin (os dados ainda dependem da RLS do usuário logado — mas como a RLS de `empresa_config` é `USING(true)` e várias tabelas são role-only, o vazamento efetivo é real; ver S5).

Complementar: `seed-platform-admin/index.ts:12-13,34,50` expõe email/senha hardcoded, **reseta a senha a cada chamada** e devolve a senha na resposta; `supabase/add-platform-admin.sql` e `reset-platform-admin.sql` + `20260521170903` promovem admins por SQL manual.

### 🔴 S2 — Service role usada em edge functions sem escopo de org

| Function | Uso de service role | Problema |
|----------|--------------------|----------|
| `api/index.ts:50` | ✅ client inteiro | **Nenhum filtro de `organization_id`** em `handleClientes/OrdensServico/Estoque/Financeiro/Dashboard` (`:125-378`) — leitura/escrita/delete cross-tenant com service role (órfã no frontend, mas publicável) |
| `asaas/index.ts:40` | só p/ checar role/org | proxy global usa chave **da plataforma** (`:55`) e aceita `create_payment`/`delete_payment`/`list_payments` (`:142,186,159`) de qualquer admin/técnico de qualquer org (FASE-2 E2) |
| `asaas-customer-sync/index.ts:37` | não | sem checagem de role/org; cria clientes na conta Asaas **da plataforma** com qualquer token válido |
| `create-customer-charge/index.ts:24` | ✅ p/ escrita | sem role check (usuário `consulta` gera cobrança/chave PIX, `:40-51`); `cliente_id` não validado por org (`:55`) |
| `create-subscription-checkout/index.ts:28` | ✅ p/ escrita | `getClaims(token)` sem token/sessão (`:19`) — provável Unauthorized em runtime (FASE-1 C7) |

### 🔴 S3 — Webhooks sem assinatura e com `verify_jwt = false`

`supabase/config.toml:3-10` declara **exatamente 3 functions** com `verify_jwt = false` — exatamente os webhooks de gateway. E nenhum deles valida assinatura HMAC:

| Webhook | Efeito sob spoofing |
|---------|---------------------|
| `asaas-platform-webhook/index.ts:35-47` | Postar `PAYMENT_CONFIRMED` marca `tenant_invoices.status='pago'` e **desbloqueia a organização** (`status='active'`, `blocked_at=null`) |
| `asaas-tenant-webhook/index.ts:25-26` | Grava `ordens_servico.status='finalizada'` (**inexistente** no enum, `types.ts:1578-1592`) e `orcamentos.status='aprovado'` |
| `mercadopago-webhook/index.ts:39-54` | **Varre `empresa_config` de todas as orgs** lendo credenciais MP (`:28-38`) e grava `'finalizada'` inválido |

Sem assinatura, **qualquer pessoa com a URL da function** pode forjar eventos de pagamento (marcar faturas pagas, desbloquear tenants, mudar status de OS/orçamento).

### 🔴 S4 — Endpoints sem autenticação e sem rate limit

- `seed-platform-admin/index.ts` — sem auth (FASE-2 E1).
- `check-overdue-tenants/index.ts:6-10` — sem auth; **bloqueia tenants em massa** com service role (FASE-2 E5).
- `test-tenant-gateway/index.ts:3-5` — sem auth (FASE-2 E5).
- `signup-tenant/index.ts:9-25` — público por design, mas **sem captcha/rate-limit** e **auto-confirma email** (`:31`), criando conta/org/`empresa_config` com service role → abuso de criação e fuga dos limites de plano (FASE-2 E6).

> Nota de configuração: `config.toml` não declara essas 4 functions. Se o deploy do projeto segue `verify_jwt = true` por default, elas ficam inalcançáveis para chamadas anônimas (quebrando signup/jobs); se não, ficam 100% públicas. O arquivo atual **não reproduz** a configuração real do projeto — é incompleto (sem seções `[auth]`, `[api]`, `[db]`, storage).

### 🟠 S5 — RLS efetiva: isolamento multi-tenant incompleto

Resumo do estado real (ver FASE-1 C1 e FASE-3 D6/D6b):

- **Role-only (sem org), admin/técnico de qualquer org acessa tudo:** `clientes`, `ordens_servico`, `itens_estoque`, `financeiro`, `orcamentos`, `rotas`, `movimentacoes_estoque`, `os_anexos`, `os_historico` (`20251207200702:222-316`, `20260304022907:5-9`, `20260307024917:6-32`, `20260311002423:21-28,45-52`).
- **`empresa_config` SELECT `USING(true)`** + credenciais de gateway em jsonb claro (`20260305130706:16-18`, `20260516205740:20-23`) → **qualquer usuário autenticado lê as API keys Asaas/MP de todas as orgs**.
- **`user_permissions` admin role-only** (`20260305123058:22-24`) → admin cross-tenant.
- **`organizations` sem policy SELECT p/ membros** no repo (FASE-3 D8).
- RPCs `count_os_current_month`/`count_active_users` SECURITY DEFINER **sem REVOKE** e com `_org` arbitrário do cliente (`20260516205740:26-36`, `useUsageLimits.tsx:36-37`).
- Todas as funções helper (`has_role`, `get_user_role`, `is_admin_or_tecnico`, `is_platform_admin`, `notify_*`) são SECURITY DEFINER sem REVOKE → EXECUTE público por default.

### 🟠 S6 — A camada de RLS org-scope não é reproduzível pelas migrations

Consequência de FASE-3 D1-D3/D10: **nenhuma migration adiciona `organization_id`** (grep: 0 matches) e `get_user_org_id()` não existe no repo. O isolamento multi-tenant do app **depende 100% de objetos criados manualmente no banco vivo**. Qualquer ambiente novo (staging/DR/desenvolvedor) ou `db reset` **não reproduz o schema** e quebraria a segurança ou o próprio boot das migrations.

### 🟠 S7 — Segredos no repositório

- `.env` **versionado** (`git ls-files` → `.env`), com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` reais; `.gitignore` **não** exclui `.env`.
- Senha do portal admin (`AdminAuth.tsx:17`) e do seed de admin (`seed-platform-admin/index.ts:13`) em texto claro.
- Credenciais de gateway (Asaas/MP) armazenadas em **jsonb em claro** em `empresa_config` e legíveis por RLS (S5).

### 🟡 S8 — Autenticação básica

- Senha mínima **6 caracteres** (Supabase default; reforço só client-side em `CadastroEmpresa.tsx:36-38,105` e `AdminAuth.tsx:13`).
- `signup-tenant:31` e `create-user:74` criam usuários com `email_confirm: true` — **sem verificação de e-mail**.
- Sem MFA, sem lockout/rate-limit de login, sem política de senha forte; `config.toml` sem seção `[auth]`.

### 🟡 S9 — CORS aberto (`*`) em todas as edge functions

`api/index.ts:5-8`, `asaas/index.ts:4-7`, `mercadolivre/index.ts:4-7`, `mercadolivre-import/index.ts:4-8`, etc. Combinado com S2/S3, qualquer origem pode invocar as functions (a proteção dependeria de `verify_jwt` + auth correta).

### 🟡 S10 — Storage

- Bucket `os-anexos`: SELECT role-only (admin/técnico, **sem org**) — anexos de OS legíveis cross-tenant; INSERT/DELETE role-only (`20251207200702:413-423`, `20260413082636:6-11`).
- Bucket `avatars`: público por design (`20260307030630:6-28`).
- `os_anexos` (tabela) e storage usam a mesma role-only, sem checagem de org.

### ✅ — Pontos positivos encontrados

| Item | Evidência |
|------|-----------|
| `movimentacoes_estoque` e `os_historico`: UPDATE/DELETE negados (append-only) | `20260413082636:14-22` |
| INSERT policies de `clientes`/`ordens_servico` org-scoped (WITH CHECK) | `20260617115620:26-34` |
| Profiles/user_roles: policies admin org-scoped | `20260516210413:7-61` |
| Platform admin policies em quase todas as tabelas | `20260521170618`, `20260617154528` |
| `generate-monthly-invoices` valida platform admin | `generate-monthly-invoices/index.ts:22-27` |
| `create-user` scoped à org do caller + role admin obrigatória | `create-user/index.ts:48,65-93` |
| `mercadolivre-import` insere com `organization_id` da própria org | `mercadolivre-import/index.ts:36-44,91` |
| Service role nunca usada no cliente/bundle (só em edge functions) | `client.ts:11` (anon key) |

---

## 4.2 — Matriz de exposição resumida

| Superfície | Vazamento/risco | Porta de entrada |
|------------|-----------------|------------------|
| Portal admin | Senha no bundle + flag localStorage | `AdminAuth.tsx:15-18,53` |
| `seed-platform-admin` | Reset/leitura de senha do super admin | URL pública da function |
| Webhooks | Faturas pagas falsas, desbloqueio de orgs, status de OS | URL pública (`verify_jwt=false`) |
| Proxy `asaas` | Conta Asaas da plataforma: listar/criar/excluir cobranças | qualquer admin/técnico autenticado |
| `api` (órfã) | CRUD total cross-tenant via service role | URL pública + JWT qualquer |
| RLS role-only | Dados de todas as orgs para admin/técnico de qualquer org | app autenticado |
| `empresa_config` | Chaves de gateway de todas as orgs | qualquer usuário autenticado |
| `check-overdue-tenants` | Bloqueio em massa | URL pública |

---

## 4.3 — Validação em runtime pendente

1. Confirmar no projeto Supabase o valor real de `verify_jwt` por function (config.toml não reproduz).
2. Confirmar se os webhooks foram registrados nos gateways com o segredo/assinatura disponível para validação.
3. Confirmar se `.env` contém a anon key vigente e se o projeto troca chaves periodicamente.
4. Confirmar se as colunas/funções "só-vivas" (FASE-3 D1-D3) têm defasagem em relação às policies (ex.: `organization_id` presente em todas as tabelas citadas).
