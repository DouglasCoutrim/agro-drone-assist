# AGENTS.md — Projeto agro-drone-assist

## Armazenamento de imagens das OS (Supabase Storage)

As fotos anexadas nas ordens de serviço são gravadas no bucket **privado** `os-anexos`
do Supabase Storage, em uma pasta por empresa. Em `public.os_anexos` fica apenas o
registro + o **caminho** do objeto — nem URL pública, nem base64 no banco.

> **Histórico:** a primeira versão gravava na hospedagem via script PHP
> (`https://livreos.net/upload-os-image.php`) com FTP como fallback. Quando o
> `livreos.net` passou a servir o próprio SPA, qualquer caminho do domínio devolveu o
> `index.html` com HTTP 200, o `JSON.parse` da função quebrava e o upload morria em
> "Resposta inválida do servidor PHP". O caminho PHP/FTP está **retirado**: o arquivo
> `hosting/upload-os-image.php` foi **removido do repositório** em 2026-11-22 (tinha o
> `$SECRET` fixo no código) e a tabela `public.ftp_config` continua no banco sem nenhum
> leitor no código.

### Fluxo

1. Técnico clica em "Anexar Imagens" na OS → câmera do celular abre.
2. A imagem é comprimida no navegador (máx. 1200px, JPEG qualidade 0.7).
3. O navegador envia a imagem para a Edge Function `ftp-upload` via `fetch` (multipart).
4. A Edge Function autentica o JWT, confere que a OS é da empresa do usuário e sobe a
   imagem no bucket `os-anexos` em
   `{organization_id}/{ordem_servico_id}/{timestamp}_{arquivo}.jpg`, usando o token do
   **próprio usuário** (não a service role) para a policy de INSERT do bucket validar
   organização e papel.
5. A Edge Function grava o caminho do objeto em `public.os_anexos.url`.
6. A tela assina a leitura na hora (`createSignedUrls`, 7 dias) e usa a URL assinada no
   `<img>`; URL que expira não vira dado no banco. Excluir o anexo também remove o
   objeto do bucket.

### Estrutura dentro do bucket `os-anexos`

```
{organization_id}/          <- uma pasta por empresa
  {ordem_servico_id}/       <- uma pasta por OS
    {timestamp}_{arquivo}.jpg
```

O bucket é privado e as policies escopam por organização (`Org admin_tecnico upload`,
`Org members view`); excluir exige `admin`.

### Configuração

- Bucket `os-anexos` (privado). A policy de INSERT aceita caminho começando pela
  `organization_id` do usuário (ou pelo id da OS da organização); a de SELECT libera o
  `owner` do objeto e `admin`/`tecnico` da mesma organização.
- A policy de SELECT libera **qualquer membro da organização** dona do arquivo
  (policy `Org members veem anexos da organizacao`, criada em 2026-11-22), inclusive o
  papel `consulta`, que antes não conseguia assinar a URL e via a miniatura quebrada.
  A escrita continua exigindo `admin`/`tecnico`.
- `public.ftp_config` (linha `id = 1`) continua no banco apenas como histórico; nada
  mais a lê. A tabela está protegida (RLS ligada, sem policy, ACL só para `postgres` e
  `service_role`), por isso os valores de host/usuário/senha foram mantidos.

### Deploy

Função em `supabase/functions/ftp-upload/index.ts` — o nome é histórico; publicada
automaticamente ao salvar.

### Observações técnicas

- Extensão do arquivo é forçada para `.jpg` na Edge Function para evitar que um
  nome malicioso termine executável dentro da pasta pública (defesa em profundidade).
- Limite de 5 MB por imagem; a compressão no navegador mantém bem abaixo disso.
- A exclusão de um anexo apaga a linha em `os_anexos` e, em seguida, o objeto no
  bucket; se a remoção do objeto falhar, sobra um objeto órfão (a linha já foi apagada).

## Segurança no banco

- Função `SECURITY DEFINER` roda como o dono e **ignora a RLS**: se ela for exposta
  pela API, todo o controle de acesso precisa estar dentro dela. Antes de criar ou
  alterar uma, conferir a ACL em `pg_proc.proacl` — `=X/postgres` é o PUBLIC (qualquer
  role, inclusive `anon`) e `anon=X` deixa visitante sem login executar.
- RPC privilegiada termina com `REVOKE ALL ... FROM public, anon` e um `GRANT EXECUTE`
  só para quem realmente chama (`authenticated` e/ou `service_role`).
- RPC que recebe id de OS ou de empresa compara a organização do dono com
  `public.get_user_org_id(auth.uid())`. `auth.uid()` nulo é o caminho de Edge
  Function/cron (`service_role`) e `public.is_platform_admin(auth.uid())` é a exceção
  do admin da plataforma. Modelo: `os_commission_calc` / `os_commission_core`
  (guarda acrescentada em 2026-11-22).
- O papel `anon` **não** tem privilégio de escrita nem `EXECUTE` de RPC. O schema nasceu
  com o padrão do Supabase (tudo concedido a `anon`, `EXECUTE` via `PUBLIC`); em 2026-11-22
  isso foi revogado (`TRUNCATE`/`MAINTAIN` não passam por RLS, e as RPC `SECURITY DEFINER`
  davam para chamar sem login). Ficaram abertas a `anon` só `SELECT` nas tabelas e as 4
  auxiliares usadas em policies de RLS (`get_user_org_id`, `has_role`, `is_admin_or_tecnico`,
  `is_platform_admin`). Objeto novo aplicado por SQL: se for função chamada por policy, ela
  precisa de `GRANT EXECUTE ... TO anon`; se for RPC de app, só `authenticated`/`service_role`.
- Edge Function nova importa `corsHeaders` de `_shared/cors.ts`, que devolve
  `Access-Control-Allow-Origin: '*'`. Motivo: o cabeçalho é estático e o mesmo app roda
  em produção (`https://livreos.net`), no preview do editor e em domínios próprios; com
  uma origem só, o navegador bloqueia o preflight e o front mostra "Failed to fetch" sem
  mensagem do servidor. A fronteira de segurança é o JWT verificado dentro da função —
  CORS não autentica. `ALLOWED_ORIGIN` continua exportado (valor `*`) porque 8 funções
  montam o próprio `corsHeaders` com ele.

## Prazo e atraso da OS

- Fonte única da regra: `src/lib/os-prazo.ts` (`calcularPrazoOS` / `osEmAtraso`).
  Nunca comparar `data_previsao` direto na tela — uma OS recém-recebida aparecia
  como atrasada antes mesmo do diagnóstico.
- Fases: **diagnóstico** (`recebido`, `aberta`, `aguardando_diagnostico`) vence em
  `data_entrada + prazo_diagnostico_horas` (coluna nova em `ordens_servico`, padrão
  **48h**, ajustável por OS pelo técnico); **aprovação** (`aguardando_aprovacao`) não
  corre prazo; **entrega** (demais status abertos) usa `data_previsao`; **encerradas**
  nunca atrasam.
- O prazo por OS é editável no formulário da OS e no diálogo de detalhes; o painel do
  técnico (`get_technician_dashboard`) devolve `prazo_diagnostico_horas` para o cálculo
  no cliente.

## Recebimento de OS (parcial/total) e contas a receber

- Todo recebimento de OS passa pelo RPC `public.registrar_recebimento_os`
  (`SECURITY DEFINER`, guarda de organização **e** de papel admin/técnico por dentro).
  Ele lança a receita em `financeiro` e faz upsert da conta a receber do saldo.
  Helper no front: `registrarRecebimentoOS` em `src/lib/os-billing.ts`.
- Tabela `contas_receber`: `valor` = total da OS, `valor_recebido` = soma paga,
  `saldo` (coluna gerada) = em aberto; `status` `aberto`/`quitado`/`cancelado`;
  guarda `vencimento`, `condicoes_pagamento` e `equipamento` (um por OS — `ordem_servico_id` é único).
- Regra: recebimento **parcial** deixa a OS **em aberto** (não muda o status) até quitar;
  a conta a receber vira o valor a cobrar depois. Pagamento total pode avançar o status.
- `fetchOsComValores` (mesmo arquivo) agora devolve `totalPago` e `saldo` (antes só `pago`);
  a tela de Financeiro lista o saldo em aberto e permite "Receber".

## Contas a pagar

- Tela `/contas-pagar` (`src/pages/ContasPagar.tsx`, item "Contas a Pagar" no grupo
  Financeiro, `requiredPermission="acesso_financeiro"`): CRUD de despesas com fornecedor,
  categoria, valor, vencimento e recorrência (semanal/mensal/anual), filtro por status
  e KPIs (a vencer, atrasado, pago no mês, total em aberto).
- A tabela `public.contas_pagar` já existia (migration `20260919230049`) com RLS; ganhou
  `valor_pago`, `saldo` (coluna gerada), `observacoes` e `updated_at`, a policy de DELETE
  que faltava (havia grant sem policy) e a RPC `public.pagar_conta_pagar`.
- Pagamento (parcial ou total) passa por `public.pagar_conta_pagar`: soma `valor_pago`,
  grava a nota em `observacoes` e marca `status = 'pago'` só quando o saldo zera (parcial
  fica `pendente`/`atrasado`). "Reabrir" zera `valor_pago` e o `data_pagamento`.
- **O pagamento não lança nada em `financeiro` de propósito**: o DRE
  (`get_dre_simplificada`) lê as despesas operacionais de `contas_pagar` com `status = 'pago'`
  (receitas vêm de `financeiro`). Lançar nos dois lugares duplicaria a despesa.
- A tabela é financeira: `anon` não tem acesso (SELECT revogado).

## Menu de navegação

- Fonte única: `src/components/layout/navConfig.ts` (`navSections`). `Sidebar.tsx`,
  `BottomNav.tsx` e `NavModules.tsx` apenas renderizam o que vem de lá, e a tela de
  permissões (`PermissionTree.tsx`) monta a árvore de checkboxes a partir do mesmo
  arquivo.
- As oito áreas são: Início, Atendimento, Cadastros, Estoque, Vendas e Notas,
  Financeiro, Configurações e Ajuda.
- **Tirar um item do menu não remove a rota.** As rotas continuam todas em `src/App.tsx`.
  Consequências de tirar um item: ele deixa de ser destacado no menu, sai da árvore de
  permissões da Equipe (bloqueios antigos daquele href ficam inertes no banco) e
  `pageTitleFor` passa a resolver o título pela rota base.
- Ao tirar um item, entregue um caminho alternativo se a tela continuar necessária (foi
  o caso de "Meu Financeiro", que virou botão no painel do técnico).

## Histórico de migrations

Existem duas pastas de migrations e elas **não** são equivalentes:

- `drizzle/migrations/` — pasta em que o projeto **escreve** (0000 a 0032). É o registro das
  mudanças feitas aqui. O `meta/_journal.json` e os snapshots param no `0023`: de `0024` em diante
  os arquivos são escritos à mão, sem `drizzle-kit generate`.
- `supabase/migrations/` — 88 arquivos gerados pelo CLI, congelados em 2026-10-03. Fica como
  **arquivo morto**: nada é acrescentado nem apagado ali.

Consequências práticas:

- O banco **não** tem esquema de controle de migrations (`supabase_migrations` não existe): o que
  está aplicado só se sabe inspecionando objetos.
- **Não rode `supabase db push`** contra produção: sem histórico no banco ele tentaria reaplicar os
  88 arquivos antigos.
- **Não rode `drizzle-kit generate`**: o snapshot para no `0023`, então ele diffs a partir dali e
  reemitiria mudanças já aplicadas.
- Mudança de banco se faz escrevendo `supabase/APROVACAO_*.sql`, mostrando o SQL, aplicando com
  aprovação e registrando o mesmo comando em `drizzle/migrations/NNNN_*.sql`.
- A migration `supabase/migrations/20260618123536_...sql` tem `TRUNCATE` de 23 tabelas e
  `DELETE FROM auth.users`, mas é **opt-in**: só executa com `platform_config.allow_full_reset`
  ligado, e essa tabela não existe no banco. Rodá-la hoje não apaga nada.