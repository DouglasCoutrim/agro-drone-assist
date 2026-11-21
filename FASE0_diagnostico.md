# FASE 0 — Diagnóstico do LivreOS (somente leitura)

Data da execução: 2026-11-19
Branch de trabalho proposto: `estabilizacao/2026-11-19`
Escopo: leitura de código/schema do repositório e SELECTs no banco. Nada foi alterado no banco
nem no repositório de migrations.

## 0. Método e limitações

Método:

1. SELECTs em `pg_proc`, `pg_policies`, `pg_class`, `information_schema.*` e `pg_get_functiondef`.
2. Grep nos arquivos de `supabase/migrations/*.sql` e `drizzle/migrations/*.sql` para extrair os
   objetos que cada arquivo cria, e comparação com o que existe hoje no banco.
3. Grep em `src/`, `supabase/functions/` e `supabase/migrations/` para confirmar uso no código.

Limitações deste ambiente (importante para as fases seguintes):

- Não tenho terminal: **não consigo criar branch, commitar, rodar `git`**, `npx tsc` ou
  `vitest run`. A plataforma registra cada resposta minha como um commit próprio; os arquivos
  são entregues por aqui, mas hashes e nome de branch precisam ser confirmados por você.
- A verificação "repositório x banco" foi feita **por presença de objeto** (função e tabela), não
  executando as migrations. Colunas, policies, triggers e índices foram conferidos apenas nos
  pontos que as fases 1 a 5 pedem. Isso está sinalizado onde importa.
- Pode haver falso positivo na lista de "objetos do banco sem arquivo": meu padrão de grep de
  tabelas exigia `CREATE TABLE ... public.nome`; arquivos que escrevem `CREATE TABLE nome`
  (sem qualificar o schema) escapam do padrão. Isso explica, por exemplo, `os_technicians` e
  `tax_retention_ledger`.

## 1. Controle de migrations

### 1.1 Existe tabela de versionamento de migrations aplicadas?

**Não existe no schema `public`.** As únicas tabelas com esse nome pertencem a outros schemas
(gerenciados pela própria plataforma):

| schema | tabela |
|---|---|
| auth | schema_migrations |
| realtime | schema_migrations |
| storage | migrations |

Consequência: **o banco não guarda quais migrations foram aplicadas**. Qualquer resposta sobre
"aplicado x não aplicado" só pode ser obtida por inspeção de objetos. Este relatório faz isso.

### 1.2 `supabase/migrations`

90 arquivos `.sql`. Composição (contagem feita sobre a listagem real):

- 49 arquivos com nome no padrão gerado automaticamente (`<timestamp>_<uuid>.sql`), dos quais os
  primeiros (2025-12 e 2026-03/06) formam a base do schema e os últimos (2026-09/10) são ajustes.
- 1 arquivo de base: `20260401000000_base_reproducao.sql`.
- 40 arquivos com nome descritivo (ex.: `20260731120000_rls_org_scope.sql`,
  `20260930120000_os_ajudantes_comissao.sql`, `20261003200000_auditoria_trilha.sql`).

### 1.3 `drizzle/migrations`

26 arquivos `.sql` (`0000` a `0025`) mais `meta/_journal.json` e 24 snapshots (`0000` a `0023`).

Achado: **o journal do drizzle parou em `0023`**.

- `0024_commission_rateio_e_faturas.sql` e `0025_pode_finalizar_os.sql` existem como arquivo,
  mas não aparecem no `_journal.json` e não têm snapshot em `meta/`.
- Ou seja: os dois arquivos mais importantes para comissão/fatura de saque nunca foram
  registrados pelo drizzle-kit.

### 1.4 Conclusão da Fase 0 sobre versionamento

Há **duas pastas de migrations concorrentes**, sem tabela de controle em nenhuma delas, e a
segunda (`drizzle`) com o journal desatualizado. Isso é o assunto da Fase 5; aqui fica só
registrado como causa provável da deriva descrita no item 5.

## 2. Funções pedidas

Todas as seis existem no banco, todas `SECURITY DEFINER`, dono `postgres`:

| função | assinatura | `search_path` | EXECUTE | autorização interna |
|---|---|---|---|---|
| `os_commission_calc` | `(_os_id uuid)` | `public` | PUBLIC, postgres, anon, authenticated, service_role | **nenhuma** (sem `auth.uid()`, sem papel, sem org) |
| `os_commission_core` | `(_os_id uuid, _force boolean)` | `public` | PUBLIC, postgres, anon, authenticated, service_role | **nenhuma** |
| `recalcular_comissoes_em_lote` | `(_somente_nao_pagas boolean)` | `public` | PUBLIC, postgres, anon, authenticated, service_role | `has_role(...,'admin')` + `get_user_org_id` |
| `create_technician_payout_invoice` | `(_os_ids uuid[], _notes text, _adjustment_ids uuid[])` | `public` | PUBLIC, postgres, anon, authenticated, service_role | exige `auth.uid()`; escopa as OS por `organization_id` e `tecnico_id` do próprio usuário |
| `get_focus_token` | `(_org uuid, _ambiente text)` | `""` (vazio) | postgres, service_role | **não** é acessível a `anon`/`authenticated` (correto) |
| `get_nfse_aliquota` | `()` | `public` | postgres, authenticated, service_role | devolve só a alíquota da org do usuário (`get_user_org_id`) |

Notas:

- `os_commission_calc` e `os_commission_core` são o par que calcula e grava o rateio da OS.
  Nenhuma das duas verifica quem está chamando.
- `get_focus_token` lê `vault.decrypted_secrets` e só pode ser chamada pelo `service_role`
  (usada pelas Edge Functions fiscais). Está correto.
- `get_nfse_aliquota` existe justamente porque `nfe_config` é restrita a admin — decisão
  registrada em `AGENTS.md`.

## 3. `nfe_config`, backups e tokens da Focus

### 3.1 Colunas com "secret"/token no nome

| coluna | tipo | observação |
|---|---|---|
| `focus_token_homologacao` | text | **token em texto puro (legado)** |
| `focus_token_producao` | text | **token em texto puro (legado)** |
| `focus_token_hom_secret_id` | uuid | aponta para `vault.secrets` |
| `focus_token_prod_secret_id` | uuid | aponta para `vault.secrets` |
| `token_ultimos4_hom` | text | os 4 últimos dígitos (para a tela) |
| `token_ultimos4_prod` | text | os 4 últimos dígitos (para a tela) |

### 3.2 Estado atual (sem expor valores)

| organização | texto hom | texto prod | vault hom | vault prod | últimos4 hom | últimos4 prod |
|---|---|---|---|---|---|---|
| e31fe856 (principal) | preenchido | preenchido | apontado | apontado | VPMn | s3kA |
| f42c8ddd | preenchido | vazio | apontado | vazio | VPMn | — |

**Achado:** os tokens existem **em duas cópias** ao mesmo tempo — no Vault (uso correto pelas
Edge Functions) e nas colunas de texto puro. A migração para o Vault foi feita, mas as colunas
antigas não foram limpas.

### 3.3 Cópia de segurança esquecida

Existe a tabela **`nfe_config_backup_20261111`** (cópia de `nfe_config` feita em 2026-11-11),
com RLS **ativo e zero policies** — ou seja, inacessível pela API (só `service_role`/owner lê),
mas provavelmente contendo os tokens em texto. Não localizei nenhuma migration no repositório
que a crie; ela foi criada direto no banco.

### 3.4 Permissões de `nfe_config`

- RLS ativo. Uma única policy: `Admin da org gerencia config NF-e`, `ALL`, para `authenticated`,
  exigindo `organization_id = get_user_org_id(auth.uid()) AND has_role(auth.uid(),'admin')`.
  Não há policy para `anon` — logo `anon` não lê nada pela API.
- No nível de tabela, `anon` e `authenticated` têm `SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
  REFERENCES, TRIGGER`. RLS é o que segura a leitura. `TRUNCATE` não é exposto pelo PostgREST,
  mas é privilégio desnecessário.

### 3.5 Onde os tokens saem hoje para o navegador (confirmado por grep)

- `src/components/fiscal/NfeConfigCard.tsx:86` — `select("*")` em `nfe_config` e o resultado é
  jogado direto no formulário; o upsert da linha 124 reenvia os campos de token; a tela os
  exibe em campos `type="password"` (linhas 166-167). **É o vazamento descrito na Fase 1.**
- `src/pages/NovaNfse.tsx:36` — também faz `select("*")` em `nfe_config` e guarda a linha
  inteira em estado. **Mesmo vazamento, em outro arquivo** (não estava na descrição da Fase 1;
  precisa entrar no mesmo commit).
- Edge Functions (`emitir-nfse-os`, `emitir-nfe-venda`, `emitir-devolucao-*`,
  `cancelar-nota-fiscal`, `nfes-recebidas`, `focus-webhook`) usam `select('*')` com o
  `service_role` — isso é aceitável, é server-side.
- `supabase/functions/_shared/focus-nfe.ts` referencia as colunas físicas
  `focus_token_homologacao`/`focus_token_producao` (linhas 10-11) além dos `*_secret_id`
  (linhas 14-15) — precisa ser lido com atenção antes de remover qualquer coluna de texto.
- Nenhum outro arquivo de `src/` lê `focus_token_*` ou faz `select("*")` em `nfe_config`.

## 4. Colunas de comissão (estado atual)

### 4.1 `empresa_config`

| coluna | tipo | padrão |
|---|---|---|
| `commission_no_note_fee` | numeric | 3.5 |

### 4.2 `profiles`

`commission_on_services` (bool), `service_commission_type` (text), `service_commission_value`
(numeric), `commission_on_products` (bool), `product_commission_type` (text),
`product_commission_value` (numeric), `pix_key`, `pix_key_type`.

### 4.3 `ordens_servico` — 18 colunas `commission_*`

`commission_services`, `commission_products`, `commission_total`, `commission_computed_at`,
`commission_ref_date`, `commission_base`, `commission_tax`, `commission_cost`,
`commission_no_note_fee`, `commission_company`, `commission_rate`, `commission_tax_rate`,
`commission_frozen_at`, `commission_paid_at`, `commission_override`,
`commission_override_reason`, `commission_override_by`, `commission_override_at`.

(As quatro últimas são o ajuste manual de comissão implementado na sessão anterior.)

### 4.4 Deriva entre `types.ts` e o banco

`src/integrations/supabase/types.ts` declara em `ordens_servico` as colunas
`commission_assistants_computed_at`, `commission_assistants_fixed`,
`commission_assistants_percentage`, `commission_assistants_total`.

**Essas quatro colunas não existem no banco** e nenhum arquivo de `src/` as usa (grep). É
resíduo de uma geração de tipos feita sobre um estado de banco que não é o atual (a migration
`20260930120000_os_ajudantes_comissao.sql` as criava; a `20261001000000_technician_commission_tax_expenses.sql`
as substituía). Relevante para a Fase 3.

### 4.5 Consulta que expõe comissão

Existe a view `vw_comissoes_tecnico` (OS + vendas). Verificado: `SELECT` concedido **apenas** a
`postgres` e `service_role` — não há `GRANT` para `anon`/`authenticated`, logo não vaza pela API.
Ela não tem a opção `security_invoker`, o que a faria ignorar RLS se fosse concedida a
`authenticated`; hoje não é um problema, mas é uma armadilha para quem for mexer nela depois.

## 5. Comparação repositório x banco

### 5.1 Funções declaradas no repositório e ausentes no banco

| função | arquivo | impacto |
|---|---|---|
| `enforce_os_monthly_limit` | `drizzle/migrations/0023_enforce_monthly_os_limit.sql` | limite mensal de OS por plano. **Não existe no banco.** A cobrança/limite pode estar sendo aplicado só no front (`useUsageLimits`) |
| `release_expired_tax_retentions` | `supabase/.../20261001000000_technician_commission_tax_expenses.sql` | retenção de imposto — feature aposentada depois, provavelmente por isso |
| `get_technician_retention_summary` | idem | idem |
| `get_technician_retention_details` | idem | idem |

### 5.2 Tabelas declaradas no repositório e ausentes no banco

| tabela | arquivo | impacto |
|---|---|---|
| `platform_config` | `20260731103406_...uuid....sql` | `src/components/admin/ConfigTab.tsx` lê essa tabela (com `as any`, linhas 40 e 59) — a tela deve falhar silenciosamente. Confirmar se a funcionalidade ainda é usada |
| `os_tecnicos_ajudantes` | `20260930000000_os_tecnicos_ajudantes.sql` | tabela dos técnicos ajudantes. `types.ts` a declara, nenhum código de `src/` a usa |
| `os_technicians` | `20261001000000_technician_commission_tax_expenses.sql` | tabela "unificada" que substituiria a anterior; não existe no banco |

Consequência para comissão: as colunas `commission_assistants_*` e as duas tabelas de ajudantes
apontam para uma funcionalidade **incompleta no banco**. Não mexi em nada.

### 5.3 Objetos no banco sem declaração localizada nas duas pastas

Lista com a ressalva do item 0: `devolucoes_compra`, `devolucoes_venda`, `fechamentos_dia`,
`fiscal_company_config`, `fiscal_documents`, `fiscal_regras`, `nfe_config_backup_20261111`,
`notas_compra`, `notas_compra_itens`, `notas_recebidas`, `sincronizacao_nfe_recebidas`,
`tax_retention_ledger`, `technician_expenses`. Vários desses vêm de arquivos que usam
`CREATE TABLE` sem qualificar `public.` — a Fase 5 refina essa lista.

### 5.4 Mesmo objeto definido em mais de um arquivo (conflito de definição)

Levantamento inicial (a Fase 5 detalha):

| objeto | arquivos que o definem |
|---|---|
| `get_technician_financial_dashboard` | `drizzle/0009`, `drizzle/0011`, `drizzle/0024`, `supabase/20261001000000` |
| `get_technician_os_statement` | `drizzle/0009`, `drizzle/0011`, `drizzle/0024`, `supabase/20261001000000` |
| `calculate_os_commission` | `supabase/20260803150000`, `supabase/20260930120000`, `drizzle/0024`, `drizzle/0025` |
| `recalc_os_commission_internal` | `drizzle/0011`, `drizzle/0024` |
| `trg_notify_os_changes` | `supabase/20260517131316`, `drizzle/0011` (além do original na supabase 20260517131316) |
| `generate_os_number` | `supabase/20251207200702`, `20251207200816`, `20260731130000`, `20260919230051` |
| `os_assignment_rules` | `drizzle/0006`, `drizzle/0025` |
| `enforce_itens_os_price` | `drizzle/0021`, `supabase/20261003150000` |
| `criar_venda` | `supabase/20261003130000`, `20261003140000`, `20261003160000` |
| `ajustar_estoque` | `supabase/20261003130000`, `20261003160000` |
| `gerar_relatorio` | `supabase/20261003180000`, `20261003190000` |
| `get_technician_dashboard` | `supabase/20260803150000`, `20260930120000` |
| `handle_new_user_permissions` | `supabase/20260305123058`, `20260919233000` |
| `protect_profile_sensitive_fields` | `supabase/20260920020000`, `20261002103440` |
| `snapshot_item_cobranca` | `supabase/20260919225841`, `20261001115409` |
| `set_user_roles` | `supabase/20260922131115`, `20260922131134` |
| `has_role`, `get_user_role`, `get_user_org_id`, `is_platform_admin`, `is_admin_or_tecnico` | `supabase/20251207200702`, `20260921160017` (e `20260401000000` para `get_user_org_id`) |
| `update_updated_at_column` | `supabase/20251207200702`, `20251207200816`, `20260919000001` |
| `count_os_current_month`, `count_active_users` | `supabase/20260516205740`, `20260731120000` |

## 6. Riscos que encontrei e que não vou corrigir sem sua decisão

Ordenados por gravidade. Nenhum deles foi alterado.

### R1 — Crítico: `os_commission_core` e `os_commission_calc` com EXECUTE para `anon` e sem checagem

`os_commission_core(_os_id, _force)` grava `commission_*` em `ordens_servico`. Ela não checa
papel nem organização e está concedida a PUBLIC (logo, `anon`). Com a chave publicável (que é
pública por natureza) e sem login, qualquer pessoa consegue disparar o recálculo e a gravação da
comissão de **qualquer OS de qualquer organização**, sabendo o id da OS. `os_commission_calc`
permite ler valores de OS de outra organização.

Isso já estava anotado como pendente em `CONTEXTO.md` (seção 10, item 5), mas agora está
comprovado no ACL: `=X/postgres` nas duas funções.

Correção sugerida (SQL para sua aprovação, na fase que você definir): `REVOKE EXECUTE ... FROM
anon, PUBLIC` nas duas e, em `os_commission_core`, uma checagem de organização quando
`auth.uid()` não for nulo (para não quebrar os triggers, que rodam sem JWT).

### R2 — Alto: tokens da Focus em texto puro no banco e no navegador

Detalhado no item 3. É exatamente o escopo da Fase 1, e inclui dois pontos que a descrição não
previa: o segundo arquivo que vaza (`NovaNfse.tsx`) e as colunas de texto puro que ainda estão
preenchidas. A limpeza das colunas de texto é `UPDATE`/`DROP COLUMN` — proibida pela sua regra 3
— então isso vai para aprovação separada.

### R3 — Médio: `nfe_config_backup_20261111`

Cópia integral de config fiscal (provavelmente com tokens) criada fora das migrations, sem
policy. Inacessível pela API, mas é dado sensível duplicado e sem dono. Decisão sua: manter,
esvaziar colunas de token ou descartar (todas exigem aprovação).

### R4 — Médio: `TRUNCATE`/`DELETE` de `nfe_config` concedidos a `anon`

Privilégios de tabela herdados do padrão do Supabase. Não é explorável pelo PostgREST, mas
deveria virar `GRANT` mínimo (`SELECT, INSERT, UPDATE` para `authenticated`, nada para `anon`).

### R5 — Médio: `types.ts` fora de sincronia com o banco

Colunas `commission_assistants_*` inexistentes. Isso afeta diretamente o critério da Fase 3
(`tsc --noEmit` limpo): regenerar os tipos a partir do banco pode resolver o erro de
`OSItemsSection.tsx` ("coluna finalidade") ou pode introduzir/remover outras divergências. Não
regenero nada sem sua confirmação.

### R6 — Informativo: `platform_config` ausente e `ConfigTab` usando `as any`

Indício de funcionalidade morta (config de plataforma / flag de reset).

## 7. Perguntas que precisam da sua decisão antes da Fase 1

1. **Branch e commits.** Não tenho `git` aqui. Confirma que os arquivos vão por esta conversa e
   você aplica o branch `estabilizacao/2026-11-19` e as mensagens de commit que eu descrever?
2. **R1 (crítico).** Autoriza tratar o `REVOKE`/checagem de organização de `os_commission_calc`
   e `os_commission_core` **junto com a Fase 1** (é uma linha de SQL e é o furo mais grave que
   encontrei) ou prefere uma fase própria com SQL aprovado antes?
3. **Fase 1 além do descrito.** Incluo `src/pages/NovaNfse.tsx` no mesmo commit (mesmo
   vazamento)? E a limpeza das colunas de texto puro de `nfe_config` (e a tabela de backup R3)
   entra como SQL de aprovação separada?
4. **Fase 3 / `types.ts`.** Autoriza regenerar `types.ts` a partir do banco (o banco é a
   verdade) em vez de editar o arquivo à mão?
5. **Fase 5.** Confirma que a Fase 5 é só relatório, e que a decisão sobre "qual pasta é a
   fonte de verdade" fica para depois de você ler esse relatório?

Paro aqui, conforme combinado, e aguardo sua confirmação para iniciar a Fase 1.
