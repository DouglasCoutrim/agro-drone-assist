# FASE 2 — Caça a Bugs (Edge Functions, Segurança e Pipeline de OS)

Data: 2026-07-31 · Escopo: leitura integral das 16 edge functions, `OrdensServico.tsx`, componentes de gateway e validação de claims de agentes de exploração.

---

## 2.1 — Descobertas críticas desta fase

> Todas as afirmações abaixo foram verificadas por leitura direta dos arquivos citados.

### 🔴 E1 — `seed-platform-admin`: credenciais hardcoded, endpoint público, senha resetada a cada chamada

`supabase/functions/seed-platform-admin/index.ts`:

- `:12-13` — email e senha do super admin **escritos em texto claro no repo** (`douglascoutrim@livreos.com` / `98751344@`).
- `:4-10` — **nenhuma autenticação**: qualquer chamada HTTP executa a function com service role.
- `:34` — se o usuário já existir, **reseta a senha** para a hardcoded a cada invocação.
- `:49-52` — a resposta devolve `email` e `password` em claro.

Qualquer pessoa que descubra a URL pública da function pode ler e/ou resetar as credenciais do super admin da plataforma. **CRÍTICO.**

### 🔴 E2 — Proxy `asaas` opera na conta Asaas da PLATAFORMA sem escopo de org

`supabase/functions/asaas/index.ts`:

- `:55` — usa `ASAAS_API_KEY` (chave **da plataforma**, não por-tenant).
- `:44-53` — valida apenas **role** (`admin`/`tecnico` ou platform admin), sem verificar a qual `organization_id` o usuário pertence.
- Ações expostas: `create_customer` (`:84`), `list_customers` (`:135`), `create_payment` (`:142`), `list_payments` (`:159`), `get_payment` (`:170`), `pix_qrcode` (`:178`), **`delete_payment`** (`:186-192`), `payment_link` (`:194`).

Qualquer **técnico de qualquer tenant** pode listar, criar ou **excluir** cobranças da conta Asaas da plataforma (e, por extensão, das outras oficinas que usam a mesma chave). É chamado pelo frontend em `Cobrancas.tsx:51,67`, `Index.tsx:103` e `OrdensServico.tsx:770,785`. **CRÍTICO.**

> Nota: a cobrança real de clientes usa `create-customer-charge` (com credenciais do próprio tenant, corretamente scoped). O proxy global `asaas` é o caminho cross-tenant.

### 🔴 E3 — `api/index.ts` usa SERVICE ROLE sem nenhum filtro de `organization_id`

`supabase/functions/api/index.ts`:

- `:50` — `createClient(supabaseUrl, supabaseServiceKey)`: tudo que a function faz ignora RLS.
- Nenhuma query filtra org: `handleClientes` (`:125-174`), `handleOrdensServico` (`:185-239`), `handleEstoque` (`:250-301`), `handleFinanceiro` (`:320-340`), `handleDashboard` (`:348-366`).
- Auth é só identidade + role global: `getClaims` (`:63`) + `user_roles` (`:22-28`), sem org.
- **Rotas reais:** `clientes | ordens-servico | estoque | financeiro | dashboard` (`:87-108`). **Não existem** rota `cobrancas` nem prefixo `premium` (correção de claim de agente, ver 2.4).
- Não é referenciada por nenhuma página (`grep functions.invoke` — nenhum match) → **órfã**, mas publicável: qualquer usuário autenticado que descubra a URL lê/cria/altera/remove dados de todos os tenants com service role.

### 🔴 E4 — Webhooks sem assinatura e gravando `status` inexistente

Nenhum webhook valida assinatura HMAC ou token de origem:

| Webhook | Sem validação | Efeito malicioso |
|---------|---------------|------------------|
| `asaas-tenant-webhook/index.ts:6-37` | `:11-14` confia no body | Qualquer pessoa posta `PAYMENT_CONFIRMED` e a function `:25` seta `ordens_servico.status='finalizada'` e `:26` `orcamentos.status='aprovado'` |
| `asaas-platform-webhook/index.ts:9-50` | `:13-16` confia no body | `:36-39` marca `tenant_invoices.status='pago'`; `:44-47` **desbloqueia a organização** (`status='active'`, `blocked_at=null`) — contorna o bloqueio por inadimplência |
| `mercadopago-webhook/index.ts:6-54` | `:11-14` confia no body | `:39-49` varre credenciais MP de todas as orgs (leitura massiva de `empresa_config`); `:52` seta `status='finalizada'` |

Adicionalmente, **`'finalizada'` não existe** no enum `status_os` (`types.ts:1578-1592` — só `aberta, em_andamento, aguardando_peca, concluida, entregue, cancelada, recebido, aguardando_diagnostico, aguardando_aprovacao, aprovado, em_reparo, em_testes, pronto_retirada`). Se o enum for enforce via CHECK constraint no banco, os updates dos webhooks **falham em runtime** (501/500); se for tipo enum nativo, a escrita é rejeitada. Divergência a confirmar na FASE 4 com acesso ao DB.

### 🔴 E5 — `check-overdue-tenants` e `test-tenant-gateway` sem autenticação

- `check-overdue-tenants/index.ts:6-8` — **nenhuma auth**; service role (`:10`); qualquer chamador executa o bloqueio em massa de tenants inadimplentes e trials expirados (`:15-49`). (Correção de claim de agente: esta function **não** valida platform admin; só `generate-monthly-invoices` valida, `:22-27`.)
- `test-tenant-gateway/index.ts:3-5` — **nenhuma auth**; `:10-24` testa credenciais arbitrárias contra Asaas/MP. Baixo risco de dados, mas endpoint público sem motivo (chamado por `IntegracoesFinanceiras.tsx:149`).

### 🟠 E6 — `signup-tenant` público: plano `'basic'` inexistente e sem rate-limit

`supabase/functions/signup-tenant/index.ts`:

- `:38-43` — `slug = plan_slug || 'trial'`; consulta `subscription_plans` com `'basic'` quando `trial`. **`'basic'` não existe** no seed (só `bronze|prata|ouro`, `20260516205740:5-8`) → `planRow` null → `:45-47` fee `0`, `max_users 3`, `max_os 100`.
- `src/pages/CadastroEmpresa.tsx:26` inicializa `plan_slug:'basic'`; se o usuário não clicar em nenhum plano, envia `'basic'` (slug que também não existe) → mesma queda silenciosa: **empresa em trial sem mensalidade e limites mínimos**.
- `:31` auto-confirma email; sem captcha/rate-limit; cria usuário/org/empresa_config com service role (`:21-90`) → abuso de criação de contas.

### 🟠 E7 — `create-customer-charge`: sem role check e cliente não validado por org

`supabase/functions/create-customer-charge/index.ts`:

- `:17` — `supabase.auth.getClaims(token)` (mesmo padrão do `create-subscription-checkout`; ver FASE-1 C7).
- Sem checagem de role → um usuário **`consulta`** pode gerar cobrança e receber a **chave PIX** da própria org (`:40-51`) e URL de pagamento.
- `:55` — busca o cliente por `id` **sem validar `organization_id`**: um usuário autenticado pode cobrar um cliente de **outra org** (o gateway usado é o do próprio tenant, mas o `email/cpf` cobrado é de outra empresa).

### 🟠 E8 — `asaas-customer-sync`: sem role check, chave da plataforma

`supabase/functions/asaas-customer-sync/index.ts`:

- `:29` — `getClaims`; **sem checagem de role/org**.
- `:37` — `ASAAS_API_KEY` (plataforma): qualquer usuário autenticado cria clientes na conta Asaas da plataforma. Chamado por `Clientes.tsx:76`.

### 🟠 E9 — `create-user`: scoped à org, mas ignora limite do plano e validação de role

`supabase/functions/create-user/index.ts`:

- Positivo: valida role `admin` (`:48`) e scopa o novo usuário à org do caller (`:65-69,88-93`).
- Falta: verificar `organizations.max_users` antes de criar; validar `role` contra `app_role` (`:96-100` aceita qualquer string).

---

## 2.2 — Componentes/páginas: pipeline de OS (leitura integral)

### Pipeline de Ordem de Serviço — `OrdensServico.tsx`

- Filtra por `organization_id` nas queries principais (correto).
- Status: usa valores do enum `status_os` (13 valores, `types.ts:1578-1592`); a UI nunca emite `'finalizada'`.
- Financeiro: `:770-776` usa o proxy `asaas` com `externalReference: viewingOS.numero` → a cobrança fica vinculada ao **número da OS**, mas os webhooks buscam a OS por **`id`** (`asaas-tenant-webhook/index.ts:25`, `mercadopago-webhook/index.ts:52` usam `externalRef` = `ordem_servico_id`, não `numero`). Divergência: o `externalReference` do PayButton não corresponde ao que o webhook espera → **o retorno do webhook não localiza a OS**.
- Anexos/PDF: geração client-side (html2canvas + jsPDF), sem upload para Storage (a confirmar na FASE 3).

### Outros componentes verificados nesta fase

| Bug | Evidência |
|-----|-----------|
| `Cobrancas.tsx:42` — dropdown de clientes sem filtro de org (cross-tenant) | `:42` |
| `Cobrancas.tsx:51,67` — chama o proxy `asaas` global (E2) | `:51,:67` |
| `IntegracoesFinanceiras.tsx:149` — chama `test-tenant-gateway` sem auth | `:149` |
| `Equipe.tsx:117,121` — `create-user` com senha em texto claro no body | `:117,:121` |
| `useUsageLimits.tsx:33` — `organization.plan === 'trial' ? 'bronze' : plan` mascara planos inexistentes | `:33` |

> Os bugs funcionais já levantados na FASE 1 (C7) seguem válidos: `Deslocamentos.tsx` 100% mock, `EmpresaConfig.tsx:70` campos descartados, `Orcamentos.tsx:90-91,153-163` sem org, `Relatorios.tsx:49-53,98` sem org, `Clientes.tsx:66` dup CPF sem org, `Rotas.tsx` coluna inexistente, `Landing.tsx` planos vazios p/ anon, `usePermissions.tsx:37-40` fail-open, `useInactivityLogout.ts:40-45` não desloga, `ProtectedRoute`/`App.tsx:105-120` rotas sem gate.

---

## 2.3 — Matriz de segurança das 16 edge functions

| Function | Auth | Role | Org | Service role | Uso no frontend |
|----------|------|------|-----|--------------|-----------------|
| `asaas` | Bearer + `getClaims` | admin/tecnico/plat | ❌ | não (anon com header) | `Cobrancas:51,67`, `Index:103`, `OrdensServico:770,785` |
| `api` | Bearer + `getClaims` | admin/tecnico/consulta | ❌ | ✅ **e sem filtro de org** | nenhum (órfã) |
| `signup-tenant` | ❌ público | — | cria org | ✅ | `CadastroEmpresa:42` |
| `seed-platform-admin` | ❌ público | — | — | ✅ | nenhum (setup) |
| `check-overdue-tenants` | ❌ público | — | — | ✅ | nenhum (job) |
| `generate-monthly-invoices` | ✅ | platform admin (`:22-27`) | — | ✅ | nenhum (job) |
| `create-customer-charge` | Bearer + `getClaims` | ❌ (qualquer autenticado) | ✅ (por profile) | ✅ | `PayButton:30` |
| `create-subscription-checkout` | Bearer + `getClaims` | ❌ | ✅ (por profile) | ✅ | `Assinatura:41` |
| `asaas-customer-sync` | Bearer + `getClaims` | ❌ | ❌ | não | `Clientes:76` |
| `create-user` | Bearer + `getUser` | ✅ admin | ✅ | ✅ | `Equipe:117` |
| `mercadolivre` | Bearer + `getUser` | ❌ (não grava) | — | não | `Estoque:222` |
| `mercadolivre-import` | Bearer + `getUser` | ❌ (grava na própria org) | ✅ | não | `Estoque:276` |
| `mercadopago-webhook` | ❌ (sem assinatura) | — | ❌ (varre todas) | ✅ | webhook |
| `asaas-platform-webhook` | ❌ (sem assinatura) | — | — | ✅ | webhook |
| `asaas-tenant-webhook` | ❌ (sem assinatura) | — | ❌ | ✅ | webhook |
| `test-tenant-gateway` | ❌ público | — | — | não | `IntegracoesFinanceiras:149` |

---

## 2.4 — Correções de claims do agente de exploração

1. **`api/index.ts` não tem rota `cobrancas` nem prefixo `premium`.** As rotas reais são `clientes|ordens-servico|estoque|financeiro|dashboard` (`:87-108`). O `delete_payment` é uma **ação do proxy `asaas`** (`asaas/index.ts:186-192`), não uma rota de `api`.
2. **`check-overdue-tenants` NÃO valida platform admin** (diferente do relatado). A validação existe apenas em `generate-monthly-invoices` (`:22-27`).

---

## 2.5 — Validação em runtime pendente (FASE 3/4)

Sem acesso ao banco vivo, fica pendente confirmar:

1. `status_os` é CHECK constraint ou enum nativo → se webhooks com `'finalizada'` falham ou são aceitos.
2. `subscription_plans` vivo tem `'basic'`? (repo só tem bronze/prata/ouro).
3. Policies reais de `organizations` (SELECT p/ membros) e se `user_permissions` tem trigger.
4. Se a função `api` está deployada no projeto Supabase (órfã em produção).
