# Relatório do commit `ca8cc3f9` — valor da OS e recebimentos

> Documento de referência do commit `ca8cc3f9a8984c257d01593d09a76cdee186f2d4`.
> Registra **o que o commit fez, por quê e como foi verificado**. Somente documentação —
> nenhum arquivo de código, migration ou dado foi alterado por este relatório.

## 1. Cabeçalho

| Campo | Valor |
|---|---|
| **Hash** | `ca8cc3f9a8984c257d01593d09a76cdee186f2d4` |
| **Data** | 2026-11-25 14:25 (-03:00) |
| **Autor** | Dyad `<douglascoutrim@gmail.com>` |
| **Mensagem original** | *Verificar diagnóstico financeiro (recebimentos/valor da OS) e decidir correções* |

## 2. Resumo

O commit resolve **duas divergências financeiras** que vinham de sessões anteriores do módulo
de comissionamento e de recebimento parcial de OS.

A primeira é o **"valor da OS"**. A mesma conta (valor final negociado → itens − desconto →
orçamento salvo) estava repetida, escrita à mão, em vários arquivos: PDF da OS, orçamento
agrupado, resumo da OS e cobrança. Como cada tela repetia a regra do seu jeito, elas
divergiam entre si — o orçamento agrupado, por exemplo, somava os itens **sem** o desconto da
OS enquanto a tela da OS mostrava o valor já com desconto.

A segunda é o **selo "Pago"**. Ele aparecia ao **finalizar** a OS, mesmo quando não havia
nenhum recebimento lançado. E o cálculo de quais OS estavam pagas (`fetchPaidOS`) considerava
qualquer linha de `financeiro` ligada à OS — inclusive **despesa** e **comissão**, que também
apontam para a OS — como prova de pagamento.

O commit cria uma **fonte única de valor** no front (`src/lib/os-valor.ts`), que espelha a
regra que já existia no banco (`public.os_commission_calc`), e reescreve a leitura de
recebimentos para distinguir **receita** de despesa/comissão e separar OS **paga** de OS
com **recebimento parcial**.

## 3. Problema diagnosticado

**Valor da OS repetido e divergente.** A regra de valor estava duplicada em pelo menos quatro
pontos:

- `OSPDFGenerator.ts` — `subtotal − desconto` ou, sem itens, `valor_orcamento`;
- `AgruparOSDialog.tsx` — somava os itens do grupo (ou o orçamento) **sem** o desconto da OS;
- `OSSummaryDialog.tsx` — `valor_final || valor_orcamento || total`, com o desconto lido da
  coluna `desconto`;
- `os-billing.ts` (`fetchOsComValores`) — `valor_final → valor_orcamento → itens − desconto`.

O efeito visível: o **orçamento agrupado** mostrava a soma dos itens **sem o desconto da OS**,
enquanto a tela da OS mostrava o valor final. Os mesmos dados geravam números diferentes
conforme a tela.

**Selo "Pago" indevido.** Duas causas:

1. `fetchPaidOS` montava o conjunto de OS pagas a partir de **qualquer** linha de `financeiro`
   com `ordem_servico_id` preenchido. Mas `financeiro` também guarda **despesas** e
   **comissões** que apontam para a OS — então uma despesa ou comissão ligada à OS já a
   marcava como paga.
2. O próprio fluxo de **finalizar** a OS adicionava o id ao conjunto de pagas
   (`setPagoOSIds(...).add(osId)`), ou seja, finalizar era tratado como receber.

## 4. Solução — fonte única de valor (`src/lib/os-valor.ts`, novo)

Arquivo novo que centraliza a definição de "valor da OS" no front, espelhando a regra do banco
em `public.os_commission_calc` (`valor_cobrado = valor_final`, ou `itens − desconto` quando
`valor_final` é 0). Traz um último degrau para OS antigas sem itens: o `valor_orcamento`.

- **`valorCobradoOS(os, totalItens)`** — valor efetivamente cobrado da OS. Ordem:
  `valor_final` → (`totalItens − desconto`) → `valor_orcamento` (OS antigas sem itens).
  Nunca devolve negativo.
- **`descontoEfetivoOS(os, totalItens)`** — desconto efetivo sobre a soma dos itens, incluindo
  o efeito de um `valor_final` negociado menor que os itens (não só a coluna `desconto`).
  Base = itens quando há itens, senão `valor_orcamento`.
- **`totalItensOS(itens)`** — soma arredondada (2 casas) dos itens; `0` quando não há itens.

O comentário no topo do arquivo deixa explícito o motivo de existir: era justamente a
repetição da regra que fazia o orçamento agrupado divergir da tela da OS.

## 5. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/os-valor.ts` **(novo)** | Fonte única da regra: `valorCobradoOS`, `descontoEfetivoOS`, `totalItensOS`. |
| `src/lib/os-valor.test.ts` **(novo)** | Testes Vitest da regra (ver seção 7). |
| `src/components/ordens-servico/OSPDFGenerator.ts` | Totais do PDF passam a usar `valorCobradoOS`/`descontoEfetivoOS` em vez da conta local. |
| `src/components/os/AgruparOSDialog.tsx` | Aplica o desconto da OS no grupo; grava `os_desconto` nos itens do orçamento; venda com `valor_produtos` **bruto** e `valor_desconto` **somado** (desconto do orçamento + descontos das OS); passa a selecionar `valor_final`; mostra a linha "Desconto da OS" na lista e nos totais. |
| `src/components/os/OSSummaryDialog.tsx` | "Valor da OS" e "Desconto" pela regra única; o rateio usa `valorCobradoOS` (antes resolvia o valor à mão). |
| `src/lib/orcamento-consolidado-pdf.ts` | `ConsolidadoGrupo.desconto` e `GroupedStoredItem.os_desconto`; `grupoSubtotal` desconta o valor da OS; PDF imprime a linha "Desconto da OS" quando houver. |
| `src/lib/os-billing.ts` | `fetchOsComValores` usa `valorCobradoOS`. |
| `src/pages/OrdensServico.tsx` | `fetchPaidOS` reescrito (só `tipo = receita` conta; saldo por `contas_receber`); novo estado `parcialOSIds` e selo "Parcial"; finalizar **não** marca mais como pago; valor da OS no detalhe pela regra única. |

### Detalhes por arquivo

**`OSPDFGenerator.ts`** — os totais do PDF (`totalFinal` e `desconto`) saem de
`valorCobradoOS(viewingOS, subtotal)` e `descontoEfetivoOS(viewingOS, subtotal)`. O desconto
exibido só aparece quando há itens (`subtotal > 0`).

**`AgruparOSDialog.tsx`** — para cada OS selecionada calcula `totalItensOS` e
`descontoEfetivoOS`; o grupo passa a carregar `desconto`. O fallback de OS sem itens usa
`valorCobradoOS` ("Serviço conforme valor da OS"). Nos totais do diálogo separa
"Desconto das OS" de "Desconto do orçamento", com `subtotalBruto = subtotal + descontoOs`.
Ao salvar, grava `os_desconto` em cada item do orçamento agrupado e lança a venda com
`valor_produtos: subtotalBruto` e `valor_desconto: desconto + descontoOs` (arredondado), de
modo que o total da venda continue fechando.

**`OSSummaryDialog.tsx`** — o cartão "Valor da OS" / "Desconto" e o valor usado no rateio
saem de `valorCobradoOS` / `descontoEfetivoOS`, no lugar do cálculo local que preferia o total
dos itens.

**`orcamento-consolidado-pdf.ts`** — `ConsolidadoGrupo` ganha `desconto?` e
`GroupedStoredItem` ganha `os_desconto?`. `groupsFromStoredItems` reconstrói o grupo lendo
`os_desconto`. `grupoSubtotal` passa a ser `max(0, itens − desconto)`. O PDF desenha a linha
"Desconto da <OS>" acima do subtotal do grupo quando houver desconto, para o PDF reaberto ficar
igual ao orçamento original.

**`os-billing.ts`** — `fetchOsComValores` troca a resolução manual do valor por
`valorCobradoOS(o, totalItens.get(o.id) || 0)`.

**`OrdensServico.tsx`** — `fetchPaidOS` foi reescrito:

- busca em `financeiro` **apenas** `tipo = receita` com `ordem_servico_id` preenchido e soma o
  `valor` recebido por OS;
- busca `contas_receber` (`ordem_servico_id`, `valor`, `valor_recebido`, `saldo`) como fonte do
  saldo por OS;
- percorre a união dos ids: recebido `<= 0,005` é ignorado; se existe conta, `saldo > 0,005`
  vira **parcial** e `saldo = 0` vira **pago**; sem conta (recebimento antigo), compara o
  recebido com `valorCobradoOS` da OS carregada para decidir pago × parcial;
- grava os dois conjuntos: `pagoOSIds` e o novo `parcialOSIds`.

Além disso: `applyStatusUpdate` e `handleSave` **deixaram de** adicionar a OS finalizada a
`pagoOSIds` ("Finalizar não é receber"); ao registrar recebimento, o conjunto de pagas é
atualizado por `quitada = res.saldo <= 0,005` (adiciona se quitou, remove se não) e o de
parciais pelo inverso; o selo "Parcial" (âmbar, `bg-amber-500`) aparece na lista e no título do
detalhe; o bloco "Total da OS"/"Orçamento salvo" e o bloco de Recebimento usam
`valorCobradoOS(viewingOS, viewItemsTotal)`.

## 6. Decisões

- **`valor_final` manda.** Quando existe um valor final negociado, ele é o valor cobrado — o
  desconto e os itens ficam como informação de origem. Isso mantém a tela idêntica à regra do
  banco em `os_commission_calc`, evitando que a prévia de comissão divirja do valor gravado.
- **Finalizar ≠ receber.** O selo "Pago" passa a depender **só** de recebimento lançado
  (`fetchPaidOS`). Finalizar uma OS muda status/datas e congela a comissão, mas não cria
  receita — então não pode marcar a OS como paga.
- **O desconto da OS entra no orçamento agrupado.** O agrupamento representa o que será cobrado
  do cliente; cobrar a soma dos itens ignorando o desconto negociado na OS seria cobrar a mais.
  Por isso o desconto da OS vira uma linha própria e é gravado (`os_desconto`) para o PDF
  reaberto reproduzir o mesmo valor.
- **`contas_receber` é a fonte do saldo.** A conta a receber guarda `valor` (total),
  `valor_recebido` e o `saldo` gerado — é o espelho oficial do que falta receber. `financeiro`
  continua sendo a fonte do **recebido** (só `tipo = receita`), e o cruzamento dos dois decide
  entre "Pago" e "Parcial". Sem conta a receber (recebimentos antigos), a comparação cai no
  valor calculado da OS.

## 7. Verificação

Testes unitários em `src/lib/os-valor.test.ts` (Vitest), cobrindo:

**`valorCobradoOS`**
- usa `valor_final` quando existe (`2500` com orçamento `3250` e desconto `750`);
- aplica o desconto sobre os itens quando não há `valor_final` (`3250 − 750 = 2500`);
- cai no `valor_orcamento` quando não há itens nem `valor_final` (OS antiga: `600`);
- nunca devolve negativo (`150 − 150 = 0`; sem itens e sem orçamento = `0`);
- trata nulos (`null` → `0`).

**`descontoEfetivoOS`**
- é a coluna `desconto` quando o `valor_final` é exatamente itens − desconto (`750`);
- inclui o efeito de um `valor_final` negociado (itens `650`, desconto `50`, `valor_final` `570`
  → desconto efetivo `80`);
- usa o orçamento como base quando não há itens (`valor_final` `570`, orçamento `600` → `30`);
- é zero quando não há desconto.

**`totalItensOS`**
- soma e arredonda (`0.1 + 0.2 = 0.3`) e trata `null` (`0`).

## 8. Pendências / observações

1. **Teste manual com as três contas (admin / técnico / consulta)** — conferir o selo "Pago" e
   "Parcial" na lista e no detalhe, e o valor da OS no detalhe, no resumo, no PDF e no
   orçamento agrupado. Os testes deste commit são unitários e não exercitam RLS nem o fluxo de
   tela.
2. **Conferir o selo "Parcial" num recebimento parcial real** — registrar um recebimento
   parcial (saldo em aberto) e confirmar que a OS mostra "Parcial" (âmbar) e não "Pago";
   quitar o saldo e confirmar a troca para "Pago".
3. **Mensalidade da plataforma permanece como estava** — a cobrança da mensalidade (clientes
   pagam via **Asaas**) não faz parte deste commit e não foi alterada por ele.
