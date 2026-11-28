# Relatório — KpiCard oficial e mapa de consumidores

> Documento de **Fase 0** do *Plano de melhoria de UI/UX do LivreOS* (Tarefa 3 da seção 15),
> na sequência do inventário
> (`docs/commits/inventario-rotas-menu-permissoes-e-entradas-contextuais.md`) e do glossário
> (`docs/commits/glossario-modulos-e-nomenclatura.md`).
> **Somente documentação:** nenhum componente, estilo, token, tela, rota, permissão, cálculo
> ou regra de negócio foi alterado por este arquivo. Os **dois** componentes `KpiCard`
> continuam existindo, exatamente como estavam. A decisão de API registrada aqui **define**
> o componente oficial; **implementar e migrar** é tarefa posterior, uma por commit.

## Baseline

- **Commit analisado:** `91a4314f67ca95bce4f7422b912daf4bee3db10e` (estado do repositório no
  início desta rodada, informado pelo ambiente de trabalho; este ambiente não expõe o
  histórico do Git para leitura).
- **Branch:** a mesma do ambiente de trabalho atual (o agente não cria branches aqui).
- **Escopo declarado:** definir o `KpiCard` oficial e mapear todos os consumidores, sem
  remover o componente antigo.

## Objetivo

O plano classifica como **P0** a existência de dois componentes de KPI com APIs, escalas de
cor, espaçamentos e comportamentos diferentes (seção 3, "Consolidar o componente de KPI").
Esta rodada resolve o problema na camada de decisão e de inventário:

1. descobre **quantos** lugares do produto desenham um indicador e **quais** são;
2. mapeia **todos** os consumidores do componente que hoje tem uso real;
3. define **qual** é o componente oficial, sua **API única** e sua **escala semântica de
   tons**;
4. registra as divergências encontradas (K1 a K15) **sem corrigir nenhuma** nesta rodada.

O escopo é a duplicidade **do indicador numérico** (KPI). Não entram aqui badges de status
(Tarefa 6 do plano), cabeçalho de página (Tarefa 4) nem escala tipográfica global (P1 da
seção 3).

## Arquivos alterados

| Arquivo | Motivo |
|---|---|
| `docs/commits/kpicard-oficial-e-consumidores.md` (novo) | Único arquivo desta rodada |

Nenhum arquivo de código foi alterado.

## Arquivos analisados (somente leitura)

**Componentes em questão**
`src/components/premium/KpiCard.tsx`; `src/components/dashboard/KpiCard.tsx`;
`src/components/premium/index.ts`; `src/components/premium/PremiumCard.tsx` (referência de
comportamento do mesmo pacote).

**Consumidores do componente premium**
`src/pages/Clientes.tsx`; `src/pages/ContasPagar.tsx`; `src/pages/Estoque.tsx`;
`src/pages/Financeiro.tsx`; `src/pages/OrdensServico.tsx`; `src/pages/Orcamentos.tsx`;
`src/pages/Vendas.tsx`; `src/pages/TechnicianFinancialDashboard.tsx`;
`src/components/relatorios/FechamentoDia.tsx`; `src/pages/Index.tsx` (import sem uso).

**Implementações paralelas de indicador**
`src/pages/TechnicianDashboard.tsx`; `src/components/os/TechnicianAnalytics.tsx`;
`src/pages/WorkshopLive.tsx`; `src/pages/Comissoes.tsx`;
`src/components/comissao/CommissionImpactTable.tsx`;
`src/pages/TechnicianFinancialDashboard.tsx`.

**Tokens e classes**
`src/index.css` (tokens `--kg-*`, `--kb-*`, `--ko-*`, `--kp-*` no tema claro e no escuro;
classes `.kpi-icon-*`, `.kpi-card`, `.tone-*`; regras de foco visível e de
`prefers-reduced-motion`).

## O que foi feito

1. Levantamento de **todos** os pontos que desenham um indicador numérico (seção 1).
2. Descrição do **componente A** (premium) — API, comportamento e defeitos (seção 2).
3. Descrição do **componente B** (dashboard) — API, comportamento e consumidores (seção 3).
4. **Mapa completo dos consumidores** do componente premium: 9 arquivos, 35 usos, com os
   adereços realmente passados em cada uso (seção 4).
5. Levantamento do **vocabulário de cor** em uso e sua correspondência com os tokens do tema
   (seção 5).
6. Levantamento da **escala CSS de KPI** e do que está órfão (seção 6).
7. **Decisão do componente oficial**, com API proposta, escala semântica de tons, regra de
   tendência e regras de acessibilidade (seção 7).
8. Registro de **15 divergências** (K1 a K15), com evidência por arquivo e linha, nenhuma
   corrigida (seção 8).
9. **Ordem de migração** sugerida, em commits separados (seção 9).

## 1. Quantos lugares desenham um indicador

| # | Onde | Tipo | Situação |
|---|---|---|---|
| 1 | `src/components/premium/KpiCard.tsx` | Componente compartilhado | **9 arquivos, 35 usos** |
| 2 | `src/components/dashboard/KpiCard.tsx` | Componente compartilhado | **Nenhum consumidor** |
| 3 | `src/pages/TechnicianDashboard.tsx` (linha 74) | Componente local `KpiCard` | 3 usos (linhas 186 a 188) |
| 4 | `src/components/os/TechnicianAnalytics.tsx` (linha 80) | Componente local `Kpi` | 5 usos (linhas 105 a 109) |
| 5 | `src/pages/WorkshopLive.tsx` (linha 62) | Componente local `MetricCard` | 4 usos (linhas 145 a 148) |
| 6 | `src/pages/Comissoes.tsx` (linha 328) | Componente local `Resumo` | 3 usos |
| 7 | `src/components/comissao/CommissionImpactTable.tsx` (linha 216) | Componente local `ResumoCard` | 3 usos (linhas 97 a 99) |
| 8 | `src/pages/Index.tsx` (linha 333) | Marcação direta (sem componente) | 4 indicadores com sparkline |
| 9 | `src/pages/TechnicianFinancialDashboard.tsx` (linha 464) | Marcação direta (sem componente) | 4 indicadores filtráveis |

Ou seja: **nove** lugares desenham indicador, com vocabulários de cor diferentes (ou nenhum:
há bloco sem tom nenhum) e **cinco** combinações diferentes de tamanho e peso para o valor
(`text-xl` semibold, `text-xl` bold, `text-xl` com `font-mono`, `text-2xl` e `text-2xl` com
`font-display`). O plano previa dois componentes; a duplicidade real é maior.

## 2. Componente A — `src/components/premium/KpiCard.tsx` (o que tem uso)

Arquivo de 13 linhas, sem comentários. Exportado também pelo pacote
`src/components/premium/index.ts`.

**API atual**

| Adereço | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `label` | `string` | sim | rótulo do indicador |
| `value` | `string \| number` | sim | valor já formatado pela tela |
| `icon` | `LucideIcon` | sim | ícone dentro de um quadrado colorido |
| `color` | `'blue' \| 'green' \| 'yellow' \| 'red' \| 'purple' \| 'orange'` | sim | sem valor padrão |
| `trend` | `{ value: number; label: string } \| string` | não | dois formatos no mesmo adereço |
| `onClick` | `() => void` | não | aplicado em um `<div>` |
| `className` | `string` | não | usado para layout |
| `delay` | `number` | não | **declarado, repassado por 28 usos e nunca aplicado** |

**Comportamento renderizado**

- caixa `min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-soft`;
- rótulo `text-xs text-muted-foreground`; valor `mt-2 break-words text-xl font-semibold
  tabular-nums`; ícone `shrink-0 rounded-lg p-2.5` + classe `kpi-icon-*`;
- `onClick` presente acrescenta `cursor-pointer hover:border-primary/30`;
- tendência em texto `mt-3 text-xs text-muted-foreground`: se `string`, apenas o texto; se
  objeto, `↑`/`↓` (caracteres, não ícones) + `Math.abs(value)%` com
  `text-success`/`text-destructive` + o rótulo.

**Mapa de tons do componente A**

`blue → kpi-icon-blue`, `green → kpi-icon-green`, `yellow → kpi-icon-orange`,
`red → kpi-icon-red`, `purple → kpi-icon-purple`, `orange → kpi-icon-orange`.

## 3. Componente B — `src/components/dashboard/KpiCard.tsx` (sem uso)

Arquivo curto, com uma escala de cor própria declarada em um objeto `colorClasses`.

**API atual**

`label`, `value`, `icon`, `color` (`'green' | 'amber' | 'red' | 'blue' | 'slate'`),
`trend?: { value: number; label: string }`, `onClick?`.

**Comportamento renderizado** — visual diferente do componente A: barra colorida de 3px no
topo, rótulo em caixa alta com `tracking-[0.06em]`, valor `text-2xl font-bold`, ícone
`w-9 h-9`, tendência com ícones `TrendingUp`/`TrendingDown` e regra `>= 0` para verde.

**Consumidores**

**Nenhum.** A busca por `KpiCard`, por `components/dashboard` e por `dashboard/KpiCard` em
todo o repositório (código, testes e documentação) retorna apenas a própria declaração do
arquivo e duas menções no relatório do glossário. Não há import, não há teste, não há
exportação por nenhum `index.ts`. O diretório `src/components/dashboard/` contém somente
esse arquivo.

Consequência: hoje ele é **código órfão**. Como a Tarefa 3 do plano proíbe remover o
componente antigo nesta rodada, ele permanece no repositório e a remoção fica registrada
como candidata na seção 9.

## 4. Mapa dos consumidores do componente premium

Nove arquivos, **35 usos**. A coluna "delay" indica os usos que passam o adereço inerte.

| Arquivo | Linhas | Usos | `color` usados | `trend` | `delay` | `onClick` | Grade do contêiner |
|---|---|---|---|---|---|---|---|
| `src/pages/Clientes.tsx` | 340 a 343 | 4 | blue, green, purple, orange | string (1 uso) | 0, 100, 200, 300 | — | `grid gap-3 grid-cols-3 sm:grid-cols-4` |
| `src/pages/ContasPagar.tsx` | 417 a 420 | 4 | blue, red, green, orange | string (4 usos) | 0, 100, 200, 300 | — | `grid gap-3 grid-cols-2 lg:grid-cols-4` |
| `src/pages/Estoque.tsx` | 417 a 445 | 4 | blue, yellow, green, purple | objeto (1 uso) | 0, 100, 200, 300 | — | `grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4` |
| `src/pages/Financeiro.tsx` | 289 a 330 | 5 | green, red, green/red (condicional), yellow, blue | objeto (5 usos, todos `value: 0`) | 0, 100, 200, 300, 400 | 1 uso (linha 328) | `grid gap-3 grid-cols-2 lg:grid-cols-5` |
| `src/pages/OrdensServico.tsx` | 1421 a 1424 | 4 | blue, yellow, orange, green | — | 0, 100, 200, 300 | — | `grid gap-3 grid-cols-2 sm:grid-cols-4` |
| `src/pages/Orcamentos.tsx` | 389 a 407 | 3 | blue, yellow, green | — | 0, 100, 200 | — | `grid gap-4 md:grid-cols-3` |
| `src/pages/Vendas.tsx` | 714 a 717 | 4 | green, orange, blue, purple | — | — | — | `grid grid-cols-1 md:grid-cols-4 gap-4` |
| `src/pages/TechnicianFinancialDashboard.tsx` | 414 a 447 | 4 | green, blue, red, green/red (condicional) | objeto (4 usos) | 0, 50, 100, 150 | — | `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` |
| `src/components/relatorios/FechamentoDia.tsx` | 200 a 202 | 3 | green, yellow, blue | — | — | — | `mt-4 grid gap-3 sm:grid-cols-3` |

**Totais:** 35 usos; 28 passam `delay`; 15 passam `trend` (5 em formato `string` e 10 em
formato objeto); 1 passa `onClick`; nenhum passa `className`; nenhum passa valor dinâmico de
`color` além das duas condicionais de Financeiro e TechnicianFinancialDashboard.

**Adereços usados em telas e não suportados pelo componente A:** `sub` (texto auxiliar, em
`TechnicianDashboard`), ausência de ícone (`TechnicianAnalytics`), estado de filtro ativo
(`TechnicianFinancialDashboard`) e sparkline (`Index.tsx`).

## 5. Vocabulário de cor em uso

| Cor atual | Classe CSS aplicada | Token por trás | Tema escuro |
|---|---|---|---|
| `green` | `.kpi-icon-green` | `--kg-bg`, `--kg-tx` | sim (`#12372A` / `#5EE0A8`) |
| `blue` | `.kpi-icon-blue` | `--kb-bg`, `--kb-tx` | sim |
| `yellow` | `.kpi-icon-orange` | `--ko-bg`, `--ko-tx` | sim |
| `orange` | `.kpi-icon-orange` | `--ko-bg`, `--ko-tx` | sim |
| `red` | `.kpi-icon-red` | `hsl(var(--destructive) / 0.1)` e `hsl(var(--destructive))` | sim |
| `purple` | `.kpi-icon-purple` | `--kp-bg`, `--kp-tx` | sim |
| `amber`, `slate` (componente B) | classes fixas `bg-amber-50`, `bg-slate-50` etc. | nenhum token | **não** |
| `bg-green-500/15 text-green-600` (TechnicianDashboard) | classes fixas | nenhum token | **não** |
| `tone: "primary" \| "warning"` (Index.tsx) | `bg-primary/15`, `bg-warning/15` | tokens de tema | sim |

Os quatro pares `--k*-bg` / `--k*-tx` existem nos dois temas, com valores diferentes em cada
um. A escala semântica oficial deve ser construída **sobre esses tokens**, não sobre a
paleta fixa do Tailwind.

## 6. Escala CSS de KPI e o que está órfão

Em `src/index.css`, no bloco `@layer components`:

- `.kpi-icon-green`, `.kpi-icon-blue`, `.kpi-icon-orange`, `.kpi-icon-purple`,
  `.kpi-icon-red` — usadas pelo componente A;
- `.kpi-card` — **sem nenhum uso** em TSX;
- `.tone-green`, `.tone-blue`, `.tone-orange`, `.tone-purple` (definem `--tone-bg`,
  `--tone-bd`, `--tone-tx`) — **sem nenhum uso** em TSX.

Não existe `.kpi-icon-neutral` nem par de tokens para estado neutro.

## 7. Decisão — o KpiCard oficial

### 7.1 Qual é o oficial

**Oficial: `src/components/premium/KpiCard.tsx`.**

Justificativa, com base no que foi lido:

1. é o **único** com consumidores (35 usos em 9 arquivos) e já é reexportado pelo pacote
   `@/components/premium`, junto de `PremiumCard`, `PremiumTable` e `AlertBox`;
2. sua cor é resolvida por **tokens de tema** (`.kpi-icon-*` → `--k*-bg` / `--k*-tx`), com
   valores próprios no tema escuro; o componente B usa cores fixas do Tailwind, que não
   acompanham o tema;
3. já cobre os adereços necessários hoje: `label`, `value`, `icon`, `color`, `trend`,
   `onClick` e `className`;
4. adota `tabular-nums` e `break-words`, adequados a valores monetários.

**Não é decisão desta rodada:** remover o componente B. Ele fica no repositório, sem uso,
até uma tarefa própria.

### 7.2 API única proposta

```ts
export type KpiTone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";
export type KpiTrend = { value: number; label: string } | string;

export interface KpiCardProps {
  label: string;            // rótulo curto, orientado à tarefa do usuário
  value: string | number;   // já formatado pela tela (formatCurrency, contagens)
  tone?: KpiTone;           // padrão: "neutral"
  icon?: LucideIcon;        // opcional: há indicador sem ícone
  hint?: string;            // texto auxiliar abaixo do valor (o "sub" do técnico)
  trend?: KpiTrend;
  onClick?: () => void;     // quando presente, o cartão é um botão de verdade
  className?: string;       // apenas para layout do consumidor
}
```

Mudanças de API em relação ao componente A:

- `color` (vocabulário visual) passa a **`tone`** (vocabulário semântico);
- `tone` e `icon` passam a ser **opcionais**, com `tone` tendo padrão `neutral`;
- `hint` é incorporado para absorver o `sub` do painel do técnico, sem criar segundo
  componente;
- `KpiCardProps` e os tipos `KpiTone`/`KpiTrend` passam a ser **exportados**;
- `delay` **sai da API**: hoje não tem efeito nenhum (não é desestruturado no componente) e
  é repassado por 28 usos. Removê-lo não altera nenhum pixel; mantê-lo apenas preserva um
  adereço que promete animação e não entrega.

### 7.3 Escala semântica de tons e equivalência

| Tom oficial | Classe CSS | Equivale hoje a | Efeito visual na migração |
|---|---|---|---|
| `success` | `.kpi-icon-green` | `green` | nenhum |
| `warning` | `.kpi-icon-orange` | `yellow` e `orange` | nenhum (hoje as duas já caem na mesma classe) |
| `danger` | `.kpi-icon-red` | `red` | nenhum |
| `info` | `.kpi-icon-blue` | `blue` | nenhum |
| `accent` | `.kpi-icon-purple` | `purple` | nenhum |
| `neutral` | classe nova (`.kpi-icon-neutral` sobre `--muted` / `--muted-foreground`) | ausência de cor e `slate` | usado por indicadores sem estado (Orcamentos "Total", Estoque "Categorias") |

A classe nova é a **única** adição prevista no CSS global. Os nomes atuais
(`.kpi-icon-orange`, `.kpi-icon-green` etc.) permanecem, para não espalhar renomeação de
classe em uma tarefa de KPI; a renomeação da escala CSS fica como limpeza posterior.

`yellow` e `orange` convergem para `warning` **porque hoje já produzem o mesmo resultado**.
Distinguir "Em Reparo" de "Aguardando" em Ordens de Serviço é decisão de produto e deve
usar texto e ícone (o rótulo já difere), não uma segunda cor.

### 7.4 Regra de tendência

| Entrada | Renderização oficial | Motivo |
|---|---|---|
| `trend` ausente | nada é renderizado | estado atual |
| `trend` string (ex.: `"em aberto"`) | texto neutro `text-muted-foreground`, sem seta e sem cor de estado | são legendas de contexto, não variação (ContasPagar, Clientes) |
| objeto com `value > 0` | seta para cima + `text-success` | estado atual |
| objeto com `value < 0` | seta para baixo + `text-destructive` | estado atual |
| objeto com `value === 0` | **sem seta**, texto neutro | corrige o "↓ 0%" vermelho de hoje |

Setas com os ícones `TrendingUp`/`TrendingDown` do lucide-react, marcados como decorativos
para leitor de tela, em vez dos caracteres `↑`/`↓` usados hoje.

### 7.5 Acessibilidade e interação

- cartão sem `onClick`: permanece um `<div>` (não é interativo);
- cartão com `onClick`: renderizado como `<button type="button">` com `text-left w-full`, de
  modo que o nome acessível venha do próprio conteúdo visível (rótulo e valor) e o cartão
  seja alcançável e acionável por teclado;
- foco visível herdado das regras globais de `:focus-visible` já existentes em
  `src/index.css`;
- cor nunca é o único sinal de estado: o rótulo e o texto da tendência acompanham o tom;
- nenhum `aria-label` extra é necessário quando rótulo e valor estão visíveis; ele só entra
  se a migração encontrar cartão cujo texto visível não descreva o conteúdo.

## 8. Divergências registradas (nenhuma corrigida)

| ID | Divergência | Evidência |
|---|---|---|
| K1 | Dois componentes `KpiCard` com APIs, escalas, espaçamentos e comportamento de tendência diferentes | `src/components/premium/KpiCard.tsx` × `src/components/dashboard/KpiCard.tsx` |
| K2 | Componente B sem nenhum consumidor em todo o repositório (código órfão); não removido nesta rodada | busca por `KpiCard`, `components/dashboard` e `dashboard/KpiCard` |
| K3 | `yellow` e `orange` caem na mesma classe `kpi-icon-orange`: "Em Reparo" e "Aguardando" saem com a mesma cor | `premium/KpiCard.tsx` linha 7; `OrdensServico.tsx` linhas 1422 e 1423 |
| K4 | `trend` com `value: 0` é exibido como queda vermelha `↓ 0%` | `Financeiro.tsx` linhas 292, 300, 308, 316 e 324; `Estoque.tsx` linha 427 (rótulo "tudo ok" em vermelho) |
| K5 | `delay` declarado na interface, repassado em 28 usos e nunca aplicado; `PremiumCard`, do mesmo pacote, aplica o mesmo adereço de verdade | `premium/KpiCard.tsx` linhas 5 e 8 × `premium/PremiumCard.tsx` linha 11 e linhas 28 a 33 |
| K6 | Cartão clicável é `<div onClick>` sem `role`, `tabIndex` ou tratamento de teclado | `premium/KpiCard.tsx` linha 9; uso em `Financeiro.tsx` linha 328 |
| K7 | `KpiCardProps` não é exportado; consumidores não conseguem tipar sua própria lista de indicadores | `premium/KpiCard.tsx` linha 3 |
| K8 | `color` é obrigatório e sem padrão; valor fora do mapa produz `tones[undefined]` (ícone sem fundo), sem erro de tipo | `premium/KpiCard.tsx` linhas 5 a 7 |
| K9 | `trend` aceita dois formatos no mesmo adereço e o componente premium usa caracteres `↑`/`↓` em vez dos ícones lucide que o componente B já usava | `premium/KpiCard.tsx` linhas 3 e 11 × `dashboard/KpiCard.tsx` linhas 11 e 77 a 79 |
| K10 | `.kpi-card` e `.tone-*` existem no CSS e não têm nenhum uso em TSX; `.kpi-icon-red` foge do padrão dos outros quatro (usa `--destructive` em vez de um par `--k*-*`) | `src/index.css` linhas 312 a 321 |
| K11 | Componente B usa cores fixas (`bg-green-50`, `bg-slate-50`, `text-green-700`) que não respondem ao tema escuro | `dashboard/KpiCard.tsx` linhas 15 a 51 |
| K12 | Sete blocos desenham indicador fora de qualquer componente compartilhado, alguns com paleta fixa (`cor="text-blue-600"`, `cor="text-amber-600"` em Comissões; `bg-green-500/15 text-green-600` no painel do técnico) | `TechnicianDashboard.tsx` 74 (usos 186 a 188); `TechnicianAnalytics.tsx` 80 (usos 105 a 109); `WorkshopLive.tsx` 62 (usos 145 a 148); `Comissoes.tsx` 328 (usos 183 a 185); `CommissionImpactTable.tsx` 216 (usos 97 a 99); `Index.tsx` 333; `TechnicianFinancialDashboard.tsx` 464 |
| K13 | `src/pages/Index.tsx` importa `KpiCard` do pacote premium e não o utiliza; o painel tem indicador próprio com sparkline | `Index.tsx` linha 17 (import) × linhas 256 e 333 (uso real) |
| K14 | Nove padrões de grade diferentes para a mesma família de cartões, com `gap-3` e `gap-4` alternados e quatro a cinco colunas como máximo | ver coluna "Grade do contêiner" da seção 4 |
| K15 | Dois caminhos de import para o mesmo componente | `@/components/premium` (Clientes, Estoque, Index, OrdensServico, Vendas, FechamentoDia) × `@/components/premium/KpiCard` (ContasPagar, Financeiro, Orcamentos, TechnicianFinancialDashboard) |

## 9. Ordem de migração sugerida

Cada passo é um commit próprio, com uma única melhoria coerente.

1. **Componente oficial** — aplicar a API da seção 7 em
   `src/components/premium/KpiCard.tsx`, acrescentar `.kpi-icon-neutral` ao CSS e migrar os
   35 usos dos 9 arquivos da seção 4 (troca de `color` por `tone`, remoção de `delay`,
   correção do `trend` com valor zero). Commit mecânico e verificável, com mudança visual
   restrita a: `↓ 0%` vermelho desaparecendo em Financeiro e Estoque.
2. **Remoção do componente órfão** — apagar `src/components/dashboard/KpiCard.tsx` em commit
   próprio, agora com a confirmação de que não há consumidor (seção 3). Separado do passo 1
   para manter o histórico legível.
3. **Blocos paralelos que são KPI simples** — `TechnicianAnalytics` (`Kpi`), `Comissoes`
   (`Resumo`) e `CommissionImpactTable` (`ResumoCard`) podem passar a usar o componente
   oficial: são indicadores sem interação.
4. **Blocos paralelos que não são KPI simples** — `Index.tsx` (indicador clicável com
   sparkline) e `TechnicianFinancialDashboard` (cartão que funciona como filtro) precisam de
   decisão própria: ou o componente oficial ganha suporte a esses dois usos, ou cada tela
   mantém o seu cartão usando os mesmos tons. Não devem ser forçados no componente simples.
5. **Contextos especiais** — `TechnicianDashboard` (usa `sub`) e `WorkshopLive` (painel
   escuro de oficina/TV) devem adotar os tons oficiais, mas podem manter marcação própria,
   conforme a regra do plano de que estilos especiais ficam restritos a contextos especiais.
6. **Limpeza posterior** — renomear a escala CSS de `.kpi-icon-*` para nomes semânticos e
   decidir o destino de `.kpi-card` e `.tone-*` (hoje órfãos).

## Decisões de UX

- **Oficial é o componente com uso real**, e não uma terceira implementação nova: criar um
  componente novo seria acrescentar duplicidade em vez de resolver (regra do plano de não
  criar segundo componente para função que já tem padrão).
- **Vocabulário semântico em vez de visual:** `tone: success | warning | danger | info |
  accent | neutral` descreve o significado, não a cor, e permite trocar o tom de um
  indicador sem reescrever a tela.
- **Cor não é o único sinal:** o texto do rótulo e da tendência acompanham o tom; a
  convergência de `yellow` e `orange` em `warning` não piora nada porque hoje as duas cores
  já são idênticas.
- **Zero não é queda:** tendência com valor zero passa a ser neutra, o que corrige a leitura
  errada em Financeiro ("↓ 0% vs mês anterior" em cinco cartões) e em Estoque
  ("tudo ok" em vermelho).
- **Cartão clicável precisa ser botão:** quem navega por teclado não alcança hoje o cartão
  "A Receber (OS)" do Financeiro.
- **Adereço que não funciona sai da API:** manter `delay` sem efeito mantém uma promessa
  falsa em 28 usos; removê-lo não muda nenhum pixel e reduz ruído na migração.
- **Tipografia do valor não é decidida aqui:** o valor fica em `text-xl font-semibold
  tabular-nums` até a tarefa de escala tipográfica (P1 da seção 3 do plano), para não
  misturar duas melhorias no mesmo commit.
- **Componente órfão não é removido agora:** o plano proíbe; a remoção é o passo 2 da
  seção 9.

## Testes executados

| Item | Resultado |
|---|---|
| Comandos de build, lint ou teste | **Nenhum comando executado.** O ambiente não expõe terminal, `tsc`, Vitest nem Playwright |
| Alteração de código | **Nenhuma**, portanto não há teste de aplicação a executar |
| Verificação feita | Leitura integral dos dois componentes, do pacote `premium`, dos 9 consumidores e dos 6 blocos paralelos; busca por `KpiCard`, `components/dashboard`, `dashboard/KpiCard`, `delay={`, `trend={`, `tone-`, `kpi-` e `from "@/components/premium"` em todo o repositório; leitura do bloco de tokens e classes de KPI em `src/index.css` |

Não declaro nenhuma execução de teste que não tenha ocorrido.

## Validação manual

| Item | Resultado |
|---|---|
| Viewport testado | **Não aplicável** — nenhuma tela foi alterada |
| Perfis testados | **Não aplicável** nesta rodada |
| Limitação registrada | Todas as conclusões vêm de leitura de código. O comportamento em tema escuro foi inferido dos tokens declarados em `src/index.css`, não observado em execução |

## Riscos e limitações

- **Decisão de produto pendente:** (a) unificar `yellow` e `orange` em um único tom
  `warning`; (b) remover `delay` da API em vez de implementá-lo como em `PremiumCard`;
  (c) manter `text-xl` para o valor até a tarefa de tipografia. As três escolhas mudam o
  contrato do componente e convém confirmá-las antes de aplicar.
- **Migrar 35 usos em um único commit** é mecânico, mas amplo. Se a preferência for diffs
  menores, o passo 1 da seção 9 pode ser dividido em dois commits (componente oficial, depois
  consumidores), sem alterar a decisão de API.
- **Não foi verificado** se as telas exibem `0` ou o valor anterior enquanto carregam, o que
  se confundiria com um zero real. O componente oficial não tem estado de carregamento
  próprio; se isso for confirmado, é tarefa separada (estados de loading e vazio).
- **`Index.tsx` e `TechnicianFinancialDashboard` não são KPI simples** (sparkline, clique e
  filtro). Forçá-los no componente oficial pode piorar a tela; por isso o passo 4 da seção 9
  exige decisão própria.
- **`WorkshopLive`** é um painel escuro de oficina: adotar os tons oficiais pode exigir uma
  variante, o que é escopo de outra rodada.
- **Tema escuro do componente B (K11)** não pode ser verificado em execução; a conclusão vem
  das classes fixas usadas no arquivo.
- **K14 (sete grades diferentes) e K15 (dois caminhos de import)** não fazem parte da
  migração do componente: são padronizações de layout e de importação que devem entrar nas
  tarefas de espaçamento (P1 da seção 3) e de limpeza de imports.
- **Nenhuma mudança de banco, RLS, cálculo, fiscal ou permissão** foi feita ou proposta nesta
  rodada.

## Commit

- **Mensagem sugerida:** `docs(ui-ux): KpiCard oficial e mapa de consumidores`
- **Hash:** criado automaticamente ao final desta rodada. Este ambiente não tem acesso ao
  histórico do repositório, então o hash não pode ser lido nem registrado aqui; deve ser
  obtido do `git log`.

## Próximo passo recomendado

**Tarefa 4 do plano: criar `PageHeader` e migrar somente Dashboard, Estoque e Financeiro** —
é a próxima tarefa pequena e independente da lista da seção 15, e não depende da decisão de
KPI.

Alternativa, se a prioridade for consistência visual imediata: aplicar o passo 1 da seção 9
(componente oficial + migração dos 35 usos), que resolve K3, K4, K5, K6, K7, K8 e K9 em um
commit verificação-por-leitura, sem tocar em cálculo, rota ou permissão.
