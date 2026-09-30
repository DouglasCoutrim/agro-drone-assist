# Auditoria Técnica — LivreOS / agro-drone-assist

Data: 2026-07-31 · Método: leitura estática integral do repositório (sem correção de código) · Stack: Vite + React 18 + TS + Tailwind + shadcn + Supabase (Postgres, Auth, Storage, Realtime, Edge Functions Deno), gateways Asaas/MP/ML, PDF client-side.

---

## Resumo executivo

O projeto tem **engenharia de produto evidente** (pipeline de OS completo, cobranças, estoque, notificações, painel de tenants, whitelabel), mas a auditoria encontrou **falhas críticas de segurança e uma base de dados não reproduzível**:

1. **Isolamento multi-tenant efetivamente quebrado** na maior parte das tabelas (policies RLS role-only + `empresa_config` com `SELECT USING(true)` expondo chaves de gateway).
2. **Backdoor de administração**: senha hardcoded no bundle + bypass via `localStorage`.
3. **Webhooks de pagamento sem assinatura** e com `verify_jwt=false` — qualquer pessoa pode forjar pagamentos/desbloqueio de tenants.
4. **Edge functions com service role sem escopo de org** (`api`, proxy `asaas`) e **endpoints públicos** (`seed-platform-admin`, `check-overdue-tenants`).
5. **Banco não reproduzível**: `organizations`, `organization_id` e `get_user_org_id()` existem **só no banco vivo**; `supabase db reset` falha nas próprias migrations.

---

## Índice das fases

| Fase | Relatório | Escopo |
|------|-----------|--------|
| 0 | [FASE-0-visao-geral.md](auditoria/FASE-0-visao-geral.md) | Estrutura, stack, modelo multi-tenant, 39 migrations, 16 edge functions |
| 1 | [FASE-1-mapeamento-funcional.md](auditoria/FASE-1-mapeamento-funcional.md) | Mapa páginas→tabelas→edge functions, matriz RLS, divergências repo↔vivo |
| 2 | [FASE-2-caca-a-bugs.md](auditoria/FASE-2-caca-a-bugs.md) | Edge functions (segurança), pipeline de OS, correções de claims |
| 3 | [FASE-3-dados-perfis-acessos.md](auditoria/FASE-3-dados-perfis-acessos.md) | Identidade, triggers, RLS de acesso, schema drift |
| 4 | [FASE-4-seguranca.md](auditoria/FASE-4-seguranca.md) | Auth, segredos, service role, webhooks, storage, CORS |
| 5 | [FASE-5-ux-rotas.md](auditoria/FASE-5-ux-rotas.md) | Rotas/proteção, bugs funcionais por página, UX |
| 6 | [FASE-6-testes-ci-reprodutibilidade.md](auditoria/FASE-6-testes-ci-reprodutibilidade.md) | Testes, CI, lockfiles, docs, reprodução |

---

## 🔴 CRÍTICO (corrigir primeiro)

| # | Achado | Evidência chave |
|---|--------|-----------------|
| C1 | **Isolamento multi-tenant quebrado**: `clientes`, `ordens_servico`, `itens_estoque`, `financeiro`, `orcamentos`, `rotas`, `movimentacoes_estoque`, `os_anexos`, `os_historico` com policies **role-only** (sem org). Qualquer admin/técnico lê/altera dados de todas as orgs. As páginas `Relatorios.tsx:49-53,98`, `Orcamentos.tsx:90-91` e `Cobrancas.tsx:42` ainda expõem dados cross-tenant no front | `20251207200702:222-316`, `20260304022907:5-9`, `20260307024917:6-32`, `20260311002423:21-52` |
| C2 | **`empresa_config` SELECT `USING(true)`** + credenciais de gateway (Asaas/MP) em jsonb claro → **qualquer usuário autenticado lê as chaves de pagamento de todas as orgs** | `20260305130706:16-18`, `20260516205740:20-23` |
| C3 | **Backdoor do portal admin**: senha hardcoded no bundle (`douglas`/`#Va_Ds12`) + autenticação é só um flag de `localStorage` | `AdminAuth.tsx:15-18,53`, `ProtectedRoute.tsx:23-26`, `useOrganization.tsx:27-32` |
| C4 | **`seed-platform-admin` público e destrutivo**: credenciais hardcoded, reseta a senha a cada chamada e devolve a senha na resposta | `seed-platform-admin/index.ts:12-13,34,50` |
| C5 | **Webhooks sem assinatura e `verify_jwt=false`**: `asaas-platform-webhook` desbloqueia orgs/marca faturas pagas; `asaas-tenant-webhook` e `mercadopago-webhook` gravam `status='finalizada'` **que não existe** no enum | `config.toml:3-10`, `asaas-platform-webhook/index.ts:35-47`, `asaas-tenant-webhook/index.ts:25`, `mercadopago-webhook/index.ts:52`, `types.ts:1578-1592` |
| C6 | **Service role sem escopo de org**: `api/index.ts` (CRUD total cross-tenant, órfa) e proxy `asaas` (opera a conta Asaas da plataforma: listar/criar/**excluir** cobranças de qualquer org) | `api/index.ts:50`, `asaas/index.ts:40-53,142,186-192` |
| C7 | **`check-overdue-tenants` sem autenticação** — qualquer chamador bloqueia tenants em massa; `test-tenant-gateway` também público | `check-overdue-tenants/index.ts:6-10`, `test-tenant-gateway/index.ts:3-5` |
| C8 | **Banco não reproduzível**: nenhuma migration cria `organizations`, nem `ADD COLUMN organization_id` (0 matches), nem `get_user_org_id()` — a camada RLS multi-tenant existe **só no banco vivo**; `db reset` falha | FASE-3 D1-D3, FASE-6 §6.4 |
| C9 | **RPCs SECURITY DEFINER sem REVOKE** (`count_os_current_month`, `count_active_users`) chamadas com `_org` arbitrário — expõem métricas de qualquer org (EXECUTE público) | `20260516205740:26-36`, `useUsageLimits.tsx:36-37` |
| C10 | **Migration destrutiva** `20260618123536` (TRUNCATE de 23 tabelas + `DELETE FROM auth.users`) no histórico | `20260618123536:2-28` |

---

## 🟠 ALTO

| # | Achado | Evidência |
|---|--------|-----------|
| A1 | Trigger `handle_new_user_permissions` **nunca criada** → usuários novos sem linha → `usePermissions.tsx:37,40` **fail-open** concede OS/Estoque por default (e rotas sem gate) | `20260305123058:27-39`, `App.tsx:103-119` |
| A2 | `signup-tenant` usa plano `'basic'` inexistente (fee 0), auto-confirma email, sem rate-limit/captcha | `signup-tenant/index.ts:38-47`, `CadastroEmpresa.tsx:26` |
| A3 | `create-customer-charge` sem role check (consulta gera cobrança/PIX) e `cliente_id` não validado por org | `create-customer-charge/index.ts:24,40-51,55` |
| A4 | `asaas-customer-sync` sem role/org check, usa chave da plataforma | `asaas-customer-sync/index.ts:29,37` |
| A5 | `organizations` **sem policy SELECT p/ membros** no repo → `useOrganization:64-68` quebra se RLS for aplicada de fato | `20260516203159:68-74` |
| A6 | `rotas.organization_id` existe só no vivo (drift) | `Rotas.tsx:62`, `types.ts:922` |
| A7 | Webhooks do Asaas/MP: `externalReference` do PayButton usa `numero` mas webhooks buscam por `id` → retorno não localiza a OS | `OrdensServico.tsx:770-776`, `asaas-tenant-webhook:25` |
| A8 | `Deslocamentos.tsx` 100% mock; `EmpresaConfig.tsx:70` descarta campos; `Orcamentos.tsx:153-163` insere OS sem org | FASE-1 C7 |
| A9 | `user_permissions` admin role-only (cross-tenant) | `20260305123058:22-24` |
| A10 | `.env` versionado com credenciais; senhas hardcoded em múltiplos pontos | `.gitignore`, `AdminAuth.tsx:17`, `seed-platform-admin:13` |

---

## 🟡 MÉDIO / PROCESSO

- Sem testes, sem CI, typecheck só via build; 3 lockfiles (npm + bun) conflitantes; README boilerplate (FASE-6).
- SQL manual fora de migrations (`supabase/fix-missing-org-id.sql`, `add-platform-admin.sql`, `reset-platform-admin.sql`).
- CORS `*` em todas as edge functions; storage `os-anexos` role-only sem org; senha mínima 6 chars; sem MFA/lockout; `signup-tenant` e `create-user` auto-confirmam email.
- Logout por inatividade não desloga (`useInactivityLogout.ts:40-45`); dois toasters montados; planos vazios na landing anônima.

---

## Prioridade de correção sugerida (quando autorizado)

1. **Sangramento de dados / RLS** (C1, C2, C9, A5) — policies org-scoped em todas as tabelas + `empresa_config`; REVOKE/restrição das RPCs.
2. **Portas de entrada** (C3, C4, C6, C7, C5) — remover backdoor e credenciais hardcoded; auth real de platform admin; validar org nas edge functions; assinar/validar webhooks; remover endpoints públicos sem auth.
3. **Reprodução** (C8, C10) — criar `organizations`, colunas `organization_id` e `get_user_org_id()` via migrations; remover/mover scripts manuais; revisar a migration destrutiva.
4. **Gates de acesso** (A1, A2, A3, A4) — trigger de permissões, plano válido no signup, role/org checks nas functions.
5. **Qualidade** (FASE-6) — testes de migrations, CI, lockfile único, documentação.

---

## Próximo passo

A auditoria está **completa** (FASE 0–6). Todos os relatórios estão em `auditoria/`. **Nenhum código foi alterado.**

Pergunta pendente: deseja **iniciar as correções pelos itens críticos** (C1–C10)? Se sim, sugiro começar por C1/C2 (RLS) ou C3/C4 (backdoor), conforme sua prioridade — e recomendo **fazer backup do banco vivo e criar um branch** antes de tocar em migrations.
