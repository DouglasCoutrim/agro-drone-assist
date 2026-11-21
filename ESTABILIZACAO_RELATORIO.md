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
- **Pendência reportada:** 11 funções expõem `*` por importarem
  `corsHeaders` de `npm:@supabase/supabase-js@2/cors` (`asaas`, `buscar-imagem-produto`,
  `cancelar-nota-fiscal`, `create-user`, `emitir-devolucao-compra`, `emitir-devolucao-venda`,
  `emitir-nfe-venda`, `emitir-nfse-os`, `focus-webhook`, `nfes-recebidas`, `suggest-team-access`).
  Não foram tocadas por não estarem na sua lista; precisam da mesma troca de duas linhas.
- Outras 5 funções já têm origem fixa, mas apontando para o projeto Supabase
  `iynljexyjhbkfxsurddn` (não para o site): `api`, `asaas-platform-webhook`,
  `asaas-tenant-webhook`, `check-overdue-tenants`, `mercadopago-webhook`. O `supabase/config.toml`
  também aponta para esse outro `project_id`.

---

## Pendências de aprovação

1. SQL da Fase 1 (`supabase/APROVACAO_fase1_fiscal_tokens.sql`).
2. Fase separada para `os_commission_calc` / `os_commission_core` (revogar `PUBLIC`/`anon` e
   checar organização) — SQL a preparar quando você pedir.
3. Decidir sobre as 11 funções com CORS `*` via import.
4. Fase 5 (migrations) e Fase 6 (branch de segurança) ainda não iniciadas.
5. Exclusão do arquivo `supabase/functions/mercadolivre-import/index.ts` e da função implantada
   (alteração de implantação — aguardando sua aprovação).
6. Migration que fixa o estado atual dos planos (aguardando conferência dos valores finais).

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
  existe. Só restam referências em documentação (`AGENTS.md`, `roadmap.md`, `auditoria/*`).
- O arquivo segue no repositório e a função segue implantada. A remoção foi **segurada**: apagar a
  pasta provavelmente dispara a exclusão da função implantada na reconciliação (precedente da
  função `mercadolivre`), e isso é a alteração de implantação que você quer aprovar antes.

### Achado de segurança (relatado, não corrigido)

`public.subscription_plans` concede `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, MAINTAIN, REFERENCES`
e `TRIGGER` para `anon`. Não há policy para `anon`, então o RLS bloqueia leitura e escrita comuns
pelo Data API; mas `TRUNCATE` não passa por RLS e as concessões no nível de tabela são desnecessárias
para um visitante anônimo. Mesmo padrão já visto em `nfe_config` na Fase 0.
