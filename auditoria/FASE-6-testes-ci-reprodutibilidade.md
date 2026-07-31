# FASE 6 — Testes, CI, Documentação e Reproduzibilidade

Data: 2026-07-31 · Escopo: tooling de qualidade, pipeline de build, lockfiles, documentação e capacidade de reproduzir o projeto do zero.

---

## 6.1 — Testes e CI

| Item | Status | Evidência |
|------|--------|-----------|
| Framework de testes | ❌ **nenhum** | `package.json:6-12` — sem script `test`; sem jest/vitest/playwright/cypress nas deps |
| Testes unitários/integração | ❌ nenhum arquivo de teste (grep `*.test.ts*`/`*.spec.ts*`) | — |
| Testes e2e | ❌ nenhum | — |
| Cobertura | ❌ n/d | — |
| CI/CD | ❌ **nenhum** | sem `.github/workflows`, `.gitlab-ci.yml`, etc. (glob retornou só bun.lock/README) |
| Lint | ✅ existe `npm run lint` (eslint) | `package.json:10` |
| Typecheck | ⚠️ sem script dedicado (só via `vite build`/TS no build) | `package.json:8` |

**Consequência:** toda a camada crítica (RLS, triggers, edge functions, webhooks) não tem nenhuma rede de segurança automatizada. Bugs como o `status: 'finalizada'` inexistente (FASE-2 E4) passaram para produção sem barreira.

## 6.2 — Gerenciamento de dependências

- **Três lockfiles coexistem**: `bun.lock`, `bun.lockb` e `package-lock.json` (raiz). `README.md:33` manda usar `npm i`, mas a presença de lockfiles bun indica fluxos mistos (Lovable/bun) — instalações divergentes e dependências não-reproduzíveis.
- `package.json:43` — `@swc/core-win32-x64-msvc` como dependência **direta** (workaround de plataforma versionado no projeto).

## 6.3 — Documentação

- `README.md` é o **boilerplate padrão do Lovable** (URL do projeto, `npm i`/`npm run dev`). Não há:
  - instruções de setup do Supabase (migrations, edge functions, env);
  - documentação de arquitetura multi-tenant/RLS;
  - lista de variáveis de ambiente das edge functions (`SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `PLATFORM_ASAAS_API_KEY`, etc.);
  - documentação de deploy/manutenção (webhooks, cron dos jobs `check-overdue-tenants`/`generate-monthly-invoices`).
- Não há `AGENTS.md` nem guias de contribuição.

## 6.4 — Reproduzibilidade do banco (o problema central)

Verificado nesta auditoria (FASE-3 D1-D3, D10):

1. **`organizations` nunca é criada nas migrations** — só `ALTER TABLE` (`20260516203159:56-65` etc.). `supabase db reset` falha na primeira ALTER.
2. **`organization_id` não é adicionado em NENHUMA migration** (grep `ADD COLUMN organization_id` → 0 matches), mas é referenciado em +20 policies RLS (ex.: `20260617115620:29,34`). Em `db reset`, essas policies falham.
3. **`get_user_org_id()` é usada em policies mas nunca definida no repo.**
4. **SQL manual fora das migrations**: `supabase/fix-missing-org-id.sql`, `add-platform-admin.sql`, `reset-platform-admin.sql` — o banco vivo foi e é alterado à mão.
5. **Migration destrutiva**: `20260618123536` TRUNCATE de 23 tabelas + `DELETE FROM auth.users`.
6. **`config.toml` incompleto** — só declara 3 functions (`:3-10`); sem seções `[auth]`, `[api]`, `[db]`, storage; não reproduz a configuração do projeto deployado.
7. **Sem `supabase/seed.sql`** e sem `.env.example`.

**Conclusão:** o projeto **não é reproduzível**. Um novo desenvolvedor, ambiente de staging/DR ou auditor não consegue subir o banco a partir do repo; o schema multi-tenant (colunas org, função de org, policies) existe apenas no banco vivo.

## 6.5 — Higiene de repositório

| Item | Status |
|------|--------|
| `.env` versionado (URL + chave pública) e **não** no `.gitignore` | ❌ `git ls-files` → `.env`; `.gitignore:1-24` sem `.env` |
| Senha hardcoded no código (`AdminAuth.tsx:17`, `seed-platform-admin:13`) | ❌ |
| Migration destrutiva no histórico | ❌ |
| Última migration `20260731103406` (platform_config) e `auditoria/` untracked; `ConfigTab.tsx` com diff não commitado | ⚠️ |

---

## 6.6 — Recomendações de processo (sem implementar)

1. Adicionar script `test` com Vitest + testes de migração (subir um Postgres local, aplicar migrations, validar policies/triggers).
2. Criar CI (GitHub Actions) rodando lint + typecheck + build + teste de migrations a cada push.
3. Unificar lockfile (escolher npm ou bun) e remover os demais.
4. Escrever um `README.md` real (setup, env vars, deploy de edge functions, webhooks, jobs).
5. Escrever migrations que **criem** `organizations`, `organization_id` e `get_user_org_id()`; mover os scripts manuais para migrations versionadas.
6. Adicionar `.env`/`.env.*` ao `.gitignore` e rotacionar credenciais expostas.
