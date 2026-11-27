# Relatório do commit `eebdedf` — correção do valor da OS e dos recebimentos

> Documento de referência do commit corretivo
> `eebdedf1339169791cf46e727cd34ad149ea1afe`, que fecha os dois bloqueadores
> apontados na revisão do commit `ca8cc3f9` (relatório anterior em
> `docs/commits/ca8cc3f9-valor-os-e-recebimentos.md`). Somente documentação: nenhum
> código, migration ou dado é alterado por este arquivo.

## 1. Cabeçalho

| Campo | Valor |
|---|---|
| **Hash (completo)** | `eebdedf1339169791cf46e727cd34ad149ea1afe` |
| **Commit anterior (com os bloqueadores)** | `ca8cc3f9a8984c257d01593d09a76cdee186f2d4` |
| **Mensagem do commit** | `fix(os): corrige desconto duplicado no orçamento agrupado e o fallback de recebimentos` |
| **Arquivos alterados** | `src/lib/os-valor.ts`; `src/components/os/AgruparOSDialog.tsx`; `src/pages/OrdensServico.tsx`; `src/lib/os-valor.test.ts`; `src/lib/orcamento-consolidado-pdf.test.ts` (novo); `e2e-tests/os-valor.spec.ts` (novo) |
| **Verificação** | 29 testes Vitest aprovados; build aprovado; `tsc --noEmit` aprovado; 10 testes Playwright aprovados com `playwright-dyad.config.ts` |

## 2. Resumo

O commit corrige dois bloqueadores encontrados na revisão do commit `ca8cc3f9`, que
unificou a regra de "valor da OS" e ajustou os selos de recebimento (Pago/Parcial).

O primeiro bloqueador era o **desconto aplicado duas vezes** no orçamento agrupado para
OS **sem itens**: a linha sintética já vinha com o valor líquido e o desconto da OS era
somado de novo em `grupoSubtotal`, fazendo a OS cobrar a menos (ex.: orçamento 600,
valor final 570 → 540).

O segundo era o **fallback de recebimentos antigos** em `fetchPaidOS`: o total da OS era
apurado sem os itens (`valorCobradoOS(os, 0)`), dependia do estado `ordens` já carregado e
ignorava erro da consulta a `contas_receber`, podendo marcar como **Paga** uma OS com
recebimento apenas parcial.

## 3. Problema corrigido

### Bloqueador 1 — desconto duplicado (OS sem itens)

- A linha sintética era criada com o valor **líquido** (`valorCobradoOS(o, 0)`);
- o grupo recebia `desconto: descontoEfetivoOS(o, 0)`;
- `grupoSubtotal` subtraía o desconto da soma dos itens → `570 − 30 = 540` (correto: 570).

### Bloqueador 2 — fallback de recebimentos sem o valor real da OS

- `valorCobradoOS(os, 0)` ignorava os itens da OS;
- dependia de `ordens` (estado da tela) já carregada;
- o erro de `contas_receber` era descartado (tratado como "sem contas");
- resultado: OS com itens e recebimento parcial era marcada como **Paga**.

## 4. Correção aplicada

- **`src/lib/os-valor.ts`** — novas funções puras:
  - `valoresDoGrupoOS(os, itens)`: devolve `{ itens, desconto }` do grupo; sem itens, a
    linha sintética carrega o valor **bruto** (`max(valor_orcamento, cobrado)`) e o
    desconto entra separado — `bruto − desconto = valorCobradoOS`.
  - `classificarRecebimentoOS(recebidoPorOS, contasPorOS, totalPorOS)`: decide `pago` ×
    `parcial`; com conta a receber, o `saldo` manda; sem conta, usa o total real; sem total
    apurado, a OS **não** é classificada.
- **`src/components/os/AgruparOSDialog.tsx`** — o `useMemo` de `grupos` passou a usar
  `valoresDoGrupoOS` (fim da mistura líquido + desconto).
- **`src/pages/OrdensServico.tsx`** — `fetchPaidOS` reescrito: só `tipo = 'receita'`;
  erro de `contas_receber` tratado explicitamente; para OS sem conta a receber, busca
  `ordens_servico` e `itens_os` direto do banco (sem depender de `ordens`) e delega a
  decisão a `classificarRecebimentoOS`.

## 5. Testes

- **`src/lib/os-valor.test.ts`** — casos de `valoresDoGrupoOS` e `classificarRecebimentoOS`
  (OS sem itens sem dupla aplicação; OS com itens; valor final negociado; recebimentos
  antigos parciais/totais; sem total apurado não classifica).
- **`src/lib/orcamento-consolidado-pdf.test.ts`** (novo) — `grupoSubtotal` desconta uma vez
  e o PDF novo × reaberto dão o mesmo total.
- **`e2e-tests/os-valor.spec.ts`** (novo) — os mesmos casos de regressão exercitando as
  funções reais (10 testes).

## 6. Verificação (execução registrada)

- **29 testes Vitest aprovados.**
- **Build aprovado.**
- **`tsc --noEmit` aprovado.**
- **10 testes Playwright aprovados** com `playwright-dyad.config.ts`.
- **`npm ci` bloqueado** por divergência entre `package.json` e `package-lock.json`
  (não é falha desta correção; a instalação não é reproduzível por `npm ci`).
- **O teste Playwright é de funções puras** e **não** é um E2E completo da interface.

## 7. Pendências

- **Validação manual com `admin`, `tecnico` e `consulta` ainda pendente.**
- `npm ci` segue bloqueado pela divergência de lockfile (tratar em tarefa separada).
- O teste Playwright cobre as funções puras; falta um E2E completo da interface para os
  fluxos de orçamento agrupado e de recebimento.
