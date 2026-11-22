# Estabilização LivreOS — relatório por fase

Branch de trabalho: `estabilizacao/2026-11-19` (a criar por quem tem acesso ao repositório).
Observação: este ambiente não tem terminal, então não executo `git` nem `tsc`/`vitest`. Cada
resposta minha é registrada como um commit pela própria plataforma; os hashes abaixo devem ser
confirmados no repositório.

| Fase | Situação | Hash |
|---|---|---|
| Fase 0 — diagnóstico | concluída (somente leitura) | ver histórico do arquivo `FASE0_diagnostico.md` |
| Fase 1 — tokens da Focus na tela | código pronto; **SQL aguardando aprovação** | a preencher |
| Fase 2 — CORS restrito (10 funções) | concluída | a preencher |
| Fase 3 — erros de tipo | não iniciada | — |
| Fase 4 — suíte de testes | não iniciada | — |
| Fase 5 — migrations | não iniciada (só relatório) | — |
| Fase 6 — branch de segurança | não iniciada | — |
| Fase 7 — relatório final | este arquivo | — |

---

## Fase 0 — Diagnóstico

Somente leitura. Relatório completo em `FASE0_diagnostico.md`. Destaques:

- Não existe controle de migrations aplicadas no schema `public`; o journal do drizzle para no `0023`.
- `os_commission_calc` e `os_commission_core` estão concedidas a `PUBLIC`/`anon` e **não** checam
  organização nem papel (decisão sua: tratar em fase separada, com SQL aprovado antes).
- Tokens da Focus em texto puro em `nfe_config` (duas cópias: colunas antigas + Vault) e a tela
  devolvia o token ao navegador.
- Tabela `nfe_config_backup_20261111` criada fora das migrations, com RLS ativo e zero policies.
- `types.ts` declara colunas que não existem no banco (`commission_assistants_*`).

## Fase 1 — os tokens da Focus não voltam ao navegador

O que foi implementado (código):

- `src/components/fiscal/NfeConfigCard.tsx`
  - lê a configuração da view `nfe_config_publica` (sem tokens), com lista explícita de colunas;
  - erro de leitura passou a aparecer (antes falhava em silêncio e a tela parecia "sem configuração");
  - os campos de token viraram substituição: mostra `Token configurado, terminando em XXXX` e um
    campo vazio para colar o token novo;
  - o `upsert` da configuração não envia mais nenhum campo de token.
- `supabase/functions/nfe-token/index.ts` (nova)
  - confere o JWT (a função é publicada com `verify_jwt = false`), exige papel `admin` e a
    organização do usuário;
  - valida o token direto na Focus (`GET /v2/nfe/teste-conexao-livreos`, mesmo critério do botão
    "Testar conexão": 404 ou 200 = token aceito);
  - grava pelo RPC `public.salvar_focus_token`, que escreve no Vault;
  - nunca devolve o token (só os 4 últimos dígitos) e nunca o registra em log.
- `supabase/APROVACAO_fase1_fiscal_tokens.sql` (**aguardando aprovação, nada executado**)
  - cria a view `nfe_config_publica` (todas as colunas fiscais, menos as quatro de segredo, mais
    `token_ultimos4_*` e `token_hom/prod_configurado`), com `security_invoker = true` para a RLS
    de `nfe_config` continuar valendo, e `grant select` só para `authenticated`/`service_role`;
  - cria `public.salvar_focus_token(uuid, text, text)`, `SECURITY DEFINER`, com nome/descrição dos
    secrets no mesmo padrão dos que já existem no Vault, `EXECUTE` apenas para `service_role`;
  - lista, comentados, os passos futuros já combinados (limpeza das colunas de texto, remoção das
    colunas, backup de 2026-11-11, revogação das funções de comissão) com o alerta de que o
    `UPDATE` de limpeza gravaria o token antigo na trilha de auditoria (trigger `trg_audit`).

**Ordem de aplicação:** rodar o SQL aprovado **antes** de subir o código do front, senão a tela de
configuração fiscal fica sem os dados (a view ainda não existiria).

Fora do escopo, por decisão sua: `src/pages/NovaNfse.tsx` (commit separado), limpeza das colunas de
texto puro e da tabela de backup (SQL aprovado, depois de 7 dias sem uso do caminho antigo).

## Fase 2 — CORS restrito

- Novo `supabase/functions/_shared/cors.ts`: origem única vinda do segredo `ALLOWED_ORIGIN`
  (padrão `https://livreos.net`), pronto para lista separada por vírgula.
- As 10 funções com `Access-Control-Allow-Origin: '*'` trocaram o valor fixo por `ALLOWED_ORIGIN`,
  mantendo os demais cabeçalhos e a resposta a `OPTIONS` de cada uma:
  `asaas-customer-sync`, `create-customer-charge` (dois blocos), `create-subscription-checkout`,
  `generate-monthly-invoices`, `mercadolivre`, `mercadolivre-import`, `seed-platform-admin`,
  `send-web-push`, `signup-tenant`, `test-tenant-gateway`.
- `supabase/functions/mercadolivre/` foi **removida** (pedido do usuário): os imports dela eram
  inválidos (`import { serve } from "https://deno.land"`), o deploy falhava e nenhum arquivo de
  `src/` a chamava. A `mercadolivre-import` continua no repositório, também sem chamadas no app.
- Nenhuma lógica de função foi alterada.
- **Resolvido em 2026-11-21:** as 11 funções que ainda importavam `corsHeaders` de
  `npm:@supabase/supabase-js@2/cors` (`asaas`, `buscar-imagem-produto`, `cancelar-nota-fiscal`,
  `create-user`, `emitir-devolucao-compra`, `emitir-devolucao-venda`, `emitir-nfe-venda`,
  `emitir-nfse-os`, `focus-webhook`, `nfes-recebidas`, `suggest-team-access`) tiveram a linha do
  import trocada por `../_shared/cors.ts`; nada mais mudou em cada função.
  `grep` por `npm:@supabase/supabase-js@2/cors` no repositório retorna apenas documentação — as 21
  funções usam o helper.
- **Corrigido em 2026-11-22:** o efeito colateral previsto aqui se confirmou — o helper devolvia só a
  PRIMEIRA origem de `ALLOWED_ORIGIN`, então fora de `https://livreos.net` o navegador bloqueava o
  preflight e o upload de anexo da OS morria com "Failed to fetch" (mensagem do `fetch`, sem resposta
  do servidor). Como o cabeçalho é estático e o app roda em produção, no preview e em futuros
  domínios próprios, `_shared/cors.ts` passou a devolver `Access-Control-Allow-Origin: '*'` e a
  exportar `ALLOWED_ORIGIN = '*'` (usado por 8 funções que montam o próprio bloco). A fronteira de
  segurança continua sendo o JWT verificado dentro de cada função — CORS não autentica.
- Outras 5 funções já têm origem fixa, mas apontando para o projeto Supabase
  `iynljexyjhbkfxsurddn` (não para o site): `api`, `asaas-platform-webhook`,
  `asaas-tenant-webhook`, `check-overdue-tenants`, `mercadopago-webhook`. O `supabase/config.toml`
  também aponta para esse outro `project_id`.

---

## Pendências de aprovação

1. SQL da Fase 1 (`supabase/APROVACAO_fase1_fiscal_tokens.sql`) — segue sem execução.
2. Fase separada para `os_commission_calc` / `os_commission_core` (revogar `PUBLIC`/`anon` e
   checar organização) — SQL a preparar quando você pedir.
3. Fase 5 (migrations): decidir qual pasta é a fonte de verdade — `drizzle/migrations/` (onde a 0026
   foi escrita, sem journal/snapshot próprios) ou a pasta gerada pelo sistema externo.
4. Teste ponta a ponta da fatura de saque com 2 ou mais OS, pela tela.
5. Fase 3 (erros de tipo) e Fase 6 (branch de segurança) ainda não iniciadas.

Aplicados em 2026-11-21: `APROVACAO_planos_estado_atual.sql` e
`APROVACAO_revogar_anon_subscription_plans.sql` (comando a comando); remoção do índice
`ordens_servico_payout_invoice_uq` com `drizzle/migrations/0026` no lugar; policy
`"Visitantes veem planos ativos"` para `anon`; e a troca do import de CORS nas 11 funções restantes.
Detalhes nas seções acima.

---

## Limpeza do Mercado Livre

### Verificação em `public.subscription_plans` (somente leitura)

- `features` é **`jsonb`** (não `json`), então o operador `-` seria válido se houvesse algo a remover.
- Planos que ainda listam a chave `mercado_livre`: **0 linhas**.
- Busca ampla (case-insensitive) por `%mercado%`: 0 linhas em `features`, 0 colunas e 0 tabelas com
  "mercado" no nome.
- O `UPDATE` que remove a chave **não foi executado**: sem linhas afetadas, seria uma escrita em
  produção sem efeito. Fica registrado que a verificação deu zero.

### Estado atual dos planos (leitura)

| slug | name | monthly_price | yearly_price | max_users | max_os/mês | features |
|---|---|---|---|---|---|---|
| Isento | Isento | 0 | 0 | 100 | 1000 | `[]` |
| bronze | Bronze | 39.90 | 0 | 2 | 30 | os, clientes, estoque, orcamentos |
| prata | Prata | 59.90 | 0 | 4 | 60 | + financeiro, cobrancas_asaas, whatsapp_templates |
| ouro | Ouro | 69.90 | 0 | 10 | -1 (ilimitado) | + rotas, whitelabel, api_rest, suporte_prioritario |

Notas:

- Não existe coluna `price`; os preços são `monthly_price` e `yearly_price`.
- `features` é um **array de strings**, não um objeto com chaves.
- `yearly_price` = 0 nos quatro planos e `billing_cycle` = `monthly` em todos.
- `Isento` tem `max_users` 100 e `max_os_per_month` 1000 (não é ilimitado) e nenhum recurso.

### Divergência com as migrations (não corrigida)

As migrations continuam com a chave e nenhuma a remove depois:

- `20260516205740_b14373ea-…sql` (linhas 7 e 8: `prata`, `ouro`)
- `20260516203757_b4496417-…sql` (linhas 10 e 16)

Os planos `bronze` e `Isento` também não existem em nenhum insert de migration. Reaplicar as
migrations do zero **reintroduz** `mercado_livre`. Nenhuma migration nova foi escrita: preço e
recursos de plano são decisão de negócio e precisam da sua aprovação sobre os valores finais.

### Front (código)

- `src/hooks/useFeatureAccess.tsx`: chave `mercado_livre` removida do tipo `FeatureKey` e do array
  de recursos do Super Admin. Nenhum consumidor de `has('mercado_livre')` existe no app.
- `src/components/UpgradePlanModal.tsx`, `src/pages/Assinatura.tsx`: texto do plano Prata passou de
  `WhatsApp & Mercado Livre` para `WhatsApp`.
- `src/pages/Landing.tsx`: "Estoque Inteligente" perdeu a menção à importação do Mercado Livre.
- A verificação de tipos (`tsc`) **não pôde ser executada**: este ambiente não tem terminal.
- Os textos de Mercado Livre dentro de migrations (conteúdo de `site_config` e de tour/onboarding)
  são dados de seed e não foram tocados.

### Edge Functions

- Nada em `src/` chama `mercadolivre-import` (verificado): a chamada antiga em `Estoque.tsx` já não
  existe e `grep` em `src/` não acha nem a palavra "mercadolivre". Só restam referências em
  documentação (`AGENTS.md`, `roadmap.md`, `auditoria/*`).
- O arquivo `supabase/functions/mercadolivre-import/index.ts` (único da pasta) foi **removido** do
  repositório, com sua aprovação. A função implantada no Supabase tende a ser excluída na
  reconciliação de deploy, pelo mesmo caminho que já removeu `mercadolivre`; este ambiente não tem
  terminal para rodar `supabase functions delete` nem para confirmar o resultado depois. Se aparecer
  nos logs uma chamada `DELETE /v1/projects/.../functions/mercadolivre-import`, é esse caminho.

### Achado de segurança (relatado, SQL proposto)

`public.subscription_plans` concedia a **`anon`**: `SELECT`, `INSERT`, `UPDATE`, `DELETE`,
`TRUNCATE`, `REFERENCES`, `TRIGGER` e `MAINTAIN`. Não há policy para `anon`, então o RLS já barra
leitura e escrita comuns pelo Data API — mas `TRUNCATE` e `MAINTAIN` **não passam por RLS** e todas
as demais concessões são desnecessárias para quem não fez login. Mesmo padrão já visto em
`nfe_config` na Fase 0.

Verificado antes de propor o SQL (somente leitura):

- `pg_has_role('authenticated','anon','MEMBER')` = **false** → revogar de `anon` não tira privilégio
  de usuário logado (`authenticated` e `anon` são papéis irmãos no Supabase).
- As 3 policies da tabela são todas `TO authenticated`; nenhuma `TO anon`.
- Servidor **PostgreSQL 17.11** (o privilégio `MAINTAIN` só existe a partir do 17).
- `has_table_privilege('anon', …, 'MAINTAIN')` = true e `authenticated` = true.
- `information_schema.role_table_grants` lista 7 privilégios por papel e **omite `MAINTAIN`**, então
  a conferência precisa da função `has_table_privilege`.

SQL escrito em `supabase/APROVACAO_revogar_anon_subscription_plans.sql`: revoga de `anon` tudo menos
`SELECT` (o `SELECT` fica de propósito, por causa da decisão da landing abaixo). Não toca
`authenticated` nem `service_role`.

### Achado novo: a landing pública não mostra planos

Não existe policy para `anon`, e a policy de leitura é `TO authenticated`. Como
`src/pages/Landing.tsx` consulta `subscription_plans` direto do navegador, um visitante **sem
login** recebe **zero linhas** e a seção de planos da página pública chega vazia — sem preços. O
`SELECT` de `anon` foi mantido na revogação justamente para não fechar essa porta antes da sua
decisão. As duas saídas estão comentadas no fim do arquivo de revogação: criar
`policy … for select to anon using (active = true)` (exibir) ou `revoke select … from anon`
(não exibir).

**Resolvido em 2026-11-21 (opção "exibir"):** criada a policy `"Visitantes veem planos ativos"` em
`public.subscription_plans`, `FOR SELECT TO anon USING (active = true)`. Conferido depois: a policy
existe com `papeis = {anon}`, `polcmd = r` e expressão `(active = true)`; as três policies anteriores
seguem intactas. O visitante sem login passa a ver só os planos com `active = true` — nome, preço,
limites e lista de recursos, exatamente o que a página pública já anunciava em texto. Reverter é uma
linha: `drop policy "Visitantes veem planos ativos" on public.subscription_plans;` (e, nesse caso,
revogar também o `SELECT` de `anon`).

Registrado também para decisão separada: existem **duas policies de admin duplicadas** na tabela
(`Platform admins manage plans` e `Platform admins manage all subscription_plans`, com expressão
idêntica), e o papel `authenticated` tem `TRUNCATE`, `REFERENCES`, `TRIGGER` e `MAINTAIN` que o app
não usa. O `REVOKE` opcional para `authenticated` está comentado no mesmo arquivo.

### Arquivos de aprovação criados e APLICADOS (2026-11-21)

- `supabase/APROVACAO_planos_estado_atual.sql` — fixa os quatro planos pelo `slug`
  (`on conflict (slug) do update`), com a rede de segurança que remove a chave `mercado_livre` de
  qualquer linha que ainda a tenha. **APLICADO.**
- `supabase/APROVACAO_revogar_anon_subscription_plans.sql` — revoga as concessões de `anon`.
  **APLICADO.**

Resultado conferido por leitura depois dos comandos:

- `subscription_plans` com 4 linhas e os valores fixados: `Isento` 0,00 · 100 usuários · 1000 OS/mês
  e nenhum recurso; `bronze` 39,90 · 2 · 30; `prata` 59,90 · 4 · 60; `ouro` 69,90 · 10 · -1
  (ilimitado). `yearly_price` 0,00 e `billing_cycle` `monthly` nos quatro.
- `planos_com_mercado_livre` = 0 (antes e depois) — a rede de segurança não afetou nenhuma linha.
- `anon` ficou apenas com `SELECT` em `subscription_plans`; `anon_maintain` = false.
- `authenticated` e `service_role` intactos (os mesmos privilégios de tabela de antes, `MAINTAIN`
  inclusive).
- `notify pgrst, 'reload schema'` executado ao final.

Observação de execução: o executor aplica **um comando por vez**, então os arquivos foram rodados
comando a comando em vez do bloco `begin/commit` único. Nada aqui dependia de atomicidade — o
`insert … on conflict` é atômico por si, o `update` da rede de segurança afetou zero linhas e o
`revoke` é um comando único. Nenhum dado foi apagado.

Ambos seguem o padrão do arquivo da Fase 1: bloco de VERIFICAÇÃO somente leitura, bloco de
ATUALIZAÇÃO e conferência. Não foram gravados em `supabase/migrations/` (pasta gerada por sistema
externo).

---

## Bug em produção — fatura de saque com mais de uma OS (aguardando aplicação)

Sintoma: ao gerar a fatura de saque o sistema não salva e responde que o registro "já está
cadastrado (valor duplicado)" — lido pelo usuário como "a ordem já foi criada" — mesmo sem nenhuma
fatura existente.

Causa: `public.ordens_servico_payout_invoice_uq`, índice **único** sobre a **única** coluna
`ordens_servico.payout_invoice_id` (`WHERE payout_invoice_id IS NOT NULL`), criado em
`drizzle/migrations/0024_commission_rateio_e_faturas.sql` linhas 137-138. Como
`create_technician_payout_invoice` grava o **mesmo** id de fatura em **todas** as OS selecionadas
(`set payout_invoice_id = v_invoice where id = any(_os_ids)`), a partir da segunda OS o PostgreSQL
levanta `duplicate key value violates unique constraint`, `getErrorMessage` traduz para
`Este registro já está cadastrado (valor duplicado).` e a transação inteira volta atrás — nada é
gravado. Fatura com uma única OS passa; com duas ou mais, falha sempre.

Evidência (somente leitura): `technician_payout_invoices` com **0 linhas**; nenhuma OS com
`payout_invoice_id` preenchido; 31 OS elegíveis em quatro técnicos de duas organizações
(`e31fe856-…` 14/9/1 e `f42c8ddd-…` 7); índice com `indisunique=true`, `indisvalid=true` e
`indimmediate=true` (a violação estoura no próprio UPDATE, não é diferível); nenhum trigger nas
tabelas de fatura; nenhuma OS apontando para fatura inexistente.

Descartado como causa: o índice `(organization_id, numero)` da fatura não pode acusar duplicidade
com a tabela vazia, e a mensagem do RPC sobre "OS que ainda não estejam em outra fatura" sequer é
levantada (todas as OS estão com `payout_invoice_id` nulo).

Remoção segura porque a garantia pretendida ("uma OS por fatura ativa") é automática: a coluna
guarda um valor por OS, o RPC já exige `payout_invoice_id is null` sob advisory lock por organização
e `os_commission_core` não recalcula OS com fatura.

Correção aplicada em **2026-11-21**: `drop index if exists ordens_servico_payout_invoice_uq` e, no
lugar, o índice **não único** `ordens_servico_payout_invoice_idx` (liquidar/cancelar/recusar buscam
`where payout_invoice_id = _invoice_id`). Conferido depois: o índice único não existe mais, o novo
existe e é **não único**, `faturas_existentes` = 0, `os_com_fatura` = 0, `os_elegiveis` = 31,
`planos` = 4 — nada foi perdido. O único índice único restante em `ordens_servico` é o
`(organization_id, numero)`.

Falta o teste ponta a ponta pela tela: gerar uma fatura de saque com **duas ou mais** OS e conferir
que a fatura nasce como rascunho `FAT-0001`, que as OS ficam com o mesmo `payout_invoice_id` e que o
extrato mostra `#FAT-0001 (rascunho)`.

Registro no histórico: `drizzle/migrations/0026_remove_indice_unico_fatura_saque.sql`, com os mesmos
dois comandos (`DROP INDEX IF EXISTS` + `CREATE INDEX IF NOT EXISTS`), idempotentes. A migration 0024
não foi reescrita, conforme a regra do projeto. Ressalvas: o journal/snapshot do drizzle não
acompanham este arquivo (já estavam inconsistentes desde a 0024) e o sistema externo que gera
`supabase/migrations/` não o enxerga — a decisão de qual pasta é a fonte de verdade continua na
Fase 5.

---

## Bug — anexo de imagem na OS (resolvido em 2026-11-21)

Sintoma: ao enviar a foto na OS aparecia "Erro ao anexar imagem: Resposta inválida do servidor PHP:
`<!doctype html> … <title>LivreOS - Gestão completa para seu negócio</title>`".

Causa: a Edge Function `ftp-upload` enviava a imagem para
`https://livreos.net/upload-os-image.php` (valor de `ftp_config.http_upload_url`). O domínio passou
a servir o próprio SPA, então qualquer caminho responde **HTTP 200 com o `index.html`** — o
`JSON.parse` da resposta estourava no `catch` que monta essa mensagem. O fallback FTP estava na mesma
situação: `ftp_config.public_url` era `https://livreos.net/uploads`, também servido pelo SPA, então
as miniaturas não carregariam nem se o upload passasse.

Correção: o destino passou a ser o bucket **privado** `os-anexos` do Supabase Storage, que já existia
(criado em 2026-11-09) e já tinha policies escopadas por organização. A Edge Function sobe o arquivo
em `{organization_id}/{ordem_servico_id}/{timestamp}_nome.jpg` com o **token do próprio usuário**
(a policy de INSERT valida organização e papel) e grava o **caminho** em `os_anexos.url`; a tela
assina a leitura na hora (`createSignedUrls`, 7 dias) e usa a URL assinada no `<img>` — URL que
expira não vira dado no banco. Excluir o anexo também remove o objeto do bucket. `ftp_config` não é
mais lida por nenhuma função.

Verificação: `os_anexos` tinha **0 linhas** antes da mudança, então não há dado antigo para
converter (o app nunca conseguiu anexar) e o formato de `url` pode mudar sem migração.

Limites conhecidos (atualizados em 2026-11-22):

- **Resolvido em 2026-11-22:** a policy de SELECT do bucket exigia `is_admin_or_tecnico`, então o
  papel `consulta` via o registro em `os_anexos` sem conseguir assinar a URL. Criada a policy
  `"Org members veem anexos da organizacao"`, que libera a leitura para qualquer membro da
  organização dona do arquivo (pelas duas convenções de caminho do bucket e pelo vínculo em
  `os_anexos`). A escrita continua exigindo `admin`/`tecnico`.
- **Resolvido em 2026-11-22:** `ftp-upload` devolvia `Access-Control-Allow-Origin: '*'` de um objeto
  local; passou a importar `corsHeaders` de `_shared/cors.ts` — as 22 funções usam o helper agora.
  O efeito colateral (origem fora de `ALLOWED_ORIGIN` não era atendida) quebrou o upload no preview
  com "Failed to fetch"; o helper voltou a devolver `*` e o problema foi resolvido na origem (ver
  Fase 2, acima).
- A função continua com o nome `ftp-upload`, que já não descreve o que faz. Renomear exigiria publicar
  outra função e remover a antiga — não há como remover função daqui.
- `hosting/upload-os-image.php` foi **removido do repositório** em 2026-11-22 (tinha `$SECRET` fixo
  no código). `ftp_config` continua no banco com host/usuário/senha do FTP: a tabela está protegida
  (RLS ligada, nenhuma policy, ACL só para `postgres` e `service_role`) e nada no código a lê, então
  os valores **não** foram apagados — apagar destruiria a única cópia da senha sem ganho de segurança.

---

## Sessão de 2026-11-22 — fiscal, comissão e anexos

### Tela de configuração fiscal estava sem dados (corrigido)

Sintoma: a tela fiscal abria vazia, a área do token dizia "não configurado" mesmo com token no Vault e
um "Salvar" com o formulário em branco sobrescreveria a configuração com nulos.

Causa: o código que lê a view `nfe_config_publica` (`src/components/fiscal/NfeConfigCard.tsx`, linha
112) já estava commitado, mas **a view nunca existiu no banco**. Sem caminho alternativo no
componente, o erro caía no `toast` e o cartão renderizava com o estado vazio.

Correção: aplicado o `supabase/APROVACAO_fase1_fiscal_tokens.sql`, na ordem combinada (SQL antes do
front). Criados a view `public.nfe_config_publica` (`security_invoker = true` para a RLS de
`nfe_config` continuar valendo, sem as quatro colunas de segredo, com `token_ultimos4_*` e
`token_hom/prod_configurado`) e `public.salvar_focus_token(uuid, text, text)` (`SECURITY DEFINER`,
grava no Vault, `EXECUTE` só para `service_role`; é a Edge Function `nfe-token` que a chama depois de
conferir JWT e papel). ACL conferida depois: `{postgres=X/postgres, service_role=X/postgres}` na
função, e só `SELECT` para `authenticated` na view. Nenhum dado foi tocado; as colunas de token em
texto puro continuam na tabela e serão limpas em passo separado (o `UPDATE` de limpeza precisa de
decisão sobre o trigger `trg_audit`).

### Funções de comissão abertas para a API (corrigido)

Estado encontrado (ACL em `pg_proc.proacl`):

| função | definer | escreve | checava org | ACL |
| --- | --- | --- | --- | --- |
| `os_commission_calc(uuid)` | sim | não | não | `{=X/postgres, anon=X, authenticated=X, service_role=X}` |
| `os_commission_core(uuid, boolean)` | sim | sim | não | `{=X/postgres, anon=X, authenticated=X, service_role=X}` |

`os_commission_calc` devolve o detalhamento financeiro da OS (valor, itens, imposto, custo, saldo,
loja, comissão) e `os_commission_core` grava as colunas de comissão de `ordens_servico`. As duas
rodam como o dono (ignoram a RLS) e não tinham `auth.uid()`, checagem de papel, checagem de
organização nem `raise exception`. Como a chave publicável vai no bundle do site, qualquer pessoa
podia chamar `POST /rest/v1/rpc/os_commission_calc` com o uuid de uma OS de outra organização e ler o
financeiro dela, ou chamar `os_commission_core` e regravar a comissão daquela OS — sem login. Um
usuário apenas logado também atravessava organizações.

Correção, em duas partes:

1. `REVOKE ALL ... FROM public, anon` nas duas. Seguro porque todos os chamadores internos
   (`recalc_os_commission_internal`, `trg_itens_os_recalc_commission`, `calculate_os_commission`,
   `finalizar_os`, `ajustar_comissao_os`, `recalcular_comissoes_em_lote`,
   `relatorio_impacto_comissao`) já são `SECURITY DEFINER` e rodam como o dono. A tela não chama
   estas funções: chama `calculate_os_commission`, que já checava a organização.
2. Guarda de organização dentro das duas, logo depois do `if not found`, **sem tocar na fórmula**:
   passa se `auth.uid()` for nulo (`service_role`/edge/cron), passa para
   `is_platform_admin(auth.uid())`, e para os demais exige
   `get_user_org_id(auth.uid())` = organização da OS, senão erro `42501`.

Testes com o JWT simulado por `set_config('request.jwt.claims', ...)`, todos de leitura:

| cenário | resultado |
| --- | --- |
| sem sessão (uid nulo) | liberado — comissão 706,49 |
| usuário de outra organização | bloqueado — "Ordem de servico de outra organizacao" |
| usuário da mesma organização | liberado — comissão 706,49 |

A OS usada no teste (`deca5bce-…`) terminou com `commission_total`, `commission_base`,
`commission_company` e `commission_computed_at` **idênticos** ao retrato tirado antes. A
`os_commission_core` não foi chamada em teste nenhum justamente para não gravar em `ordens_servico`.
ACL final das duas: `{postgres=X, authenticated=X, service_role=X}` — sem `anon`, sem PUBLIC.

### Anexos legíveis pelo papel `consulta` (corrigido)

Ver a seção do bug de anexo acima: nova policy de SELECT no bucket. Registrada na migration 0029.

### Registro no histórico

- `drizzle/migrations/0027_nfe_config_publica_e_token_no_vault.sql`
- `drizzle/migrations/0028_guarda_organizacao_comissao.sql`
- `drizzle/migrations/0029_policy_org_members_os_anexos.sql`

A pergunta da Fase 5 (qual pasta é a fonte de verdade do histórico) continua aberta: os três arquivos
foram escritos em `drizzle/migrations/`, seguindo o `0026`, e `supabase/migrations/` continua sem
receber nada escrito à mão.

---

## Fase 3 — objetos ausentes: verificação por cruzamento (2026-11-22)

Sem terminal não há `tsc`; o que dá para fazer é comparar o que o código chama com o que existe no
banco. Resultado do cruzamento:

**Tabelas lidas/escritas por `supabase.from(...)`:** nenhuma ausente, com **uma exceção** —
`platform_config`.

**RPCs chamados por `supabase.rpc(...)`:** os 23 existem todos no banco (`notify_broadcast_global`,
`notify_broadcast_org`, `relatorio_impacto_comissao`, `recalcular_comissoes_em_lote`,
`ajustar_comissao_os`, `gerar_relatorio`, `get_nfse_aliquota`, `get_technician_financial_dashboard`,
`get_technician_os_statement`, `create_technician_payout_invoice`, `send_technician_payout_invoice`,
`cancel_technician_payout_invoice`, `criar_venda`, `editar_venda`, `cancelar_venda`,
`reverter_alteracao`, `settle_technician_payout_invoice`, `processar_demonstracoes_vencidas`,
`criar_saida_demonstracao`, `concluir_saida_demonstracao`, `transferir_estoque_tecnico`,
`finalizar_os`, `confirmar_recebimento_os`, `devolver_estoque_central`, `get_technician_dashboard`,
`get_workshop_board`, `calculate_os_commission`). Nenhuma chamada apontando para o vazio.

**Buckets de Storage referenciados:** `avatars`, `logos`, `som`, `wiki-media` e `os-anexos` — todos
existem.

### `platform_config` — a tela salva num lugar que ninguém lê (decisão sua)

`src/components/admin/ConfigTab.tsx` (linhas 40 e 59) lê e grava a chave `asaas` em
`public.platform_config`, que **não existe no banco**: a tela abre com "Falha ao carregar
configurações" e o "Salvar" também falha. E há um agravante: **nenhuma Edge Function lê essa
tabela** — `asaas`, `create-subscription-checkout` e `generate-monthly-invoices` pegam o token dos
segredos `ASAAS_API_KEY` / `PLATFORM_ASAAS_API_KEY` do ambiente (`grep` por `platform_config` em
`supabase/functions/` não encontra nada).

O arquivo `supabase/migrations/20260731103406_...sql` (nunca aplicado) cria a tabela com RLS e
policies de platform admin, mas sem `GRANT`. **Não apliquei nada**, porque criar a tabela não
consertaria a causa: a tela continuaria salvando um token que não tem efeito, agora sem erro visível
— o que é pior que o erro atual. As saídas possíveis, para você escolher:

1. tirar o cartão "Integração Asaas" da tela (o token já é configurado por segredo do ambiente);
2. criar `platform_config` **e** trocar as três funções para ler dela;
3. manter como está enquanto a tela do admin master não for usada.

### `types.ts` desatualizado (não corrigido de propósito)

`src/integrations/supabase/types.ts` declara as colunas `commission_assistants_*` e as tabelas
`os_tecnicos_ajudantes` e `os_technicians`, que **não existem no banco**. Nenhum arquivo de `src/`
usa essas tabelas (a busca encontra só `types.ts`, migrations e documentos): é arquivo gerado fora de
sincronia, não bug de runtime. Como o arquivo é gerado a partir do banco de produção e não há CLI
aqui, não editei à mão.

## Fase 5 — qual pasta é a fonte de verdade (respondida em 2026-11-22)

Levantamento:

| | `drizzle/migrations/` | `supabase/migrations/` |
| --- | --- | --- |
| arquivos | 0000 a 0029 | 88, nomes gerados com uuid |
| último | `0029_policy_org_members_os_anexos.sql` | `20261003200000_auditoria_trilha.sql` |
| quem escreve | o projeto (nomes descritivos) | CLI do Supabase |
| cobertura | todo o trabalho de nov/2026 (`0024` a `0029`) | para em 2026-10-03 |

O `meta/_journal.json` e os snapshots param no `0023`: de `0024` em diante os arquivos foram
escritos à mão, sem `drizzle-kit generate`.

O banco **não tem esquema de controle de migrations** (`information_schema.schemata` só encontra
`auth`, `extensions`, `public`, `storage`, `vault` e afins — não existe `supabase_migrations`), e o
`RELATORIO_P0_VENDA_ESTOQUE.md` já tinha chegado à mesma conclusão. Sem histórico no banco, nada é
aplicado automaticamente e qualquer pergunta de "aplicado ou não" se responde inspecionando objetos.

**Correção de um alarme do FASE-0:** a migration `20260618123536_...` (⚠️ "🔴 ALTO: TRUNCATE de
tabelas de negócio + DELETE FROM auth.users") é **opt-in** — o `DO $$` só executa o TRUNCATE se
`platform_config` tiver `allow_full_reset = {"enabled": true}`, e essa tabela não existe. Rodá-la hoje
apenas emite `NOTICE 'Reset completo IGNORADO'`. O perigo real dela é outro: como o banco não guarda
histórico, um `supabase db push` tentaria reaplicar **os 88 arquivos**, e não apenas esse.

**Resposta:** `drizzle/migrations/` é a pasta em que o projeto escreve e é o registro das mudanças;
`supabase/migrations/` fica como arquivo morto, sem receber nem perder arquivos. Duas proibições
práticas, registradas no `AGENTS.md`: não rodar `supabase db push` em produção (reaplicaria os 88
arquivos antigos) e não rodar `drizzle-kit generate` (o snapshot para no `0023`, então ele
reemitiria mudanças já aplicadas).
