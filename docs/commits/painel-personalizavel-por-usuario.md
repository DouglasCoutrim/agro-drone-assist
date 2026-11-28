# Relatório — painel personalizável por usuário (protótipo)

> Rodada de **protótipo**, na sequência do kanban arrastável do painel do técnico
> (commit `6f345cc`). Entrega duas coisas: um **protótipo funcional** para o solicitante
> avaliar a interação e a **proposta de persistência no banco** que ele autorizou a preparar.
> **A proposta de banco não foi executada**: nenhuma tabela, coluna, política ou permissão
> foi criada ou alterada nesta rodada.

## Baseline

- **Commit analisado:** `6f345cc97c29022295bee581ce9a924838eee130` (kanban arrastável do
  painel do técnico), informado pelo ambiente de trabalho; este ambiente não expõe o
  histórico do Git para leitura.
- **Branch:** a mesma do ambiente de trabalho atual.
- **Escopo declarado pelo solicitante:** arrastar em **todo o sistema**, sendo que
  - no **painel do técnico** arrastar **altera o status da OS** (já entregue);
  - nos **demais quadros** arrastar é **somente visual**, para o usuário organizar a tela;
  - a configuração é **por usuário**;
  - a decisão entre arrastar sempre ativo ou só em um modo "Personalizar" fica **para depois
    de ver o primeiro protótipo**.

## Objetivo

Responder, com algo clicável, à pergunta "todos os painéis podem funcionar assim?".
O protótipo existe para o solicitante **sentir a interação** (arrastar, lembrar a ordem,
restaurar) antes de decidirmos a forma final e antes de qualquer mudança de banco.

## Regra central adotada (separação de significados)

O gesto de arrastar **não pode ter dois significados na mesma tela**. Por isso:

| Superfície | Arrastar significa | Onde |
|---|---|---|
| Quadro de status | **Altera o dado** (status da OS, com todas as validações) | Painel do Técnico (kanban) |
| Painel de blocos | **Somente organiza a visão**, nunca grava em registro | Início (protótipo desta rodada) e demais painéis |

Consequências assumidas nesta rodada:

- a personalização **não** alcança colunas de kanban, nem a ordem de itens dentro de tabelas
  ou listas de dados;
- a personalização **não** esconde nem libera dados: só muda a ordem dos blocos. Um bloco
  cujo dado é bloqueado por permissão continua bloqueado, e esconder bloco é tarefa futura,
  com a mesma regra de permissão;
- o puxador de arrastar é **explícito** (um botão com ícone e o nome do bloco). Arrastar o
  conteúdo do bloco não faz nada — evita arrasto acidental em gráfico, tabela ou rolagem.

## Arquivos alterados

| Arquivo | Motivo |
|---|---|
| `src/lib/painel-layout.ts` (novo) | Ordem dos blocos: ler, gravar, limpar e normalizar (protótipo: no navegador, por usuário) |
| `src/lib/painel-layout.test.ts` (novo) | Testes da lógica pura (`moverItem`, `normalizarOrdem`) |
| `src/components/layout/PainelOrdenavel.tsx` (novo) | Componente reutilizável: puxadores, arrasto (mouse e toque), teclado, "Restaurar padrão" |
| `src/pages/Index.tsx` | Envolve os quatro blocos do Início e marca cada um com `data-bloco`/`data-rotulo` |
| `docs/commits/painel-personalizavel-por-usuario.md` (novo) | Este relatório |

Nenhuma mudança de banco, RLS, cálculo, fiscal, permissão ou regra de negócio.

## O que foi feito

### 1. Componente `PainelOrdenavel`

Uso em qualquer tela:

```tsx
<PainelOrdenavel tela="inicio">
  <div data-bloco="indicadores" data-rotulo="Indicadores">...</div>
  <section data-bloco="alertas" data-rotulo="Requer atenção">...</section>
</PainelOrdenavel>
```

- cada filho direto marcado com `data-bloco` (id estável) e `data-rotulo` (nome no puxador)
  vira um bloco ordenável; filhos sem marca continuam sendo renderizados no fim;
- arrasto por **Pointer Events**, então funciona com **mouse e com o dedo** (o `touch-none`
  no puxador impede a página de rolar durante o arrasto);
- **teclado**: com o puxador focado, ↑ e ↓ movem o bloco, com anúncio em `aria-live`;
- **"Restaurar padrão"** aparece só quando a ordem está diferente do padrão;
- a ordem é regravada a cada mudança e **limpa** quando o usuário volta ao padrão;
- ordem salva é **normalizada** contra os blocos atuais: bloco que deixou de existir é
  descartado, bloco novo entra no fim — nenhum bloco desaparece depois de uma atualização.

### 2. Protótipo aplicado ao Início

Os quatro blocos do painel foram marcados e envolvidos:

| `data-bloco` | Rótulo exibido | O que contém |
|---|---|---|
| `indicadores` | Indicadores | os quatro cartões de KPI com sparkline |
| `faturamento` | Faturamento e resumo financeiro | cartão verde do celular, gráfico do computador e o resumo com rosca |
| `alertas` | Requer atenção | OS atrasadas e estoque baixo (só aparece quando há alerta) |
| `os-atividades` | OS e atividades recentes | tabela de OS recentes e a linha de atividades |

O cabeçalho do celular (saudação e busca) e o cabeçalho do computador **ficaram de fora** do
arrasto de propósito: a saudação tem sobreposição negativa com a barra de busca e precisa
continuar fixa no topo.

### 3. Persistência do protótipo (temporária)

A ordem é gravada em `localStorage`, na chave `livreos:painel:<id do usuário>:<tela>` — ou
seja, já é **por usuário**, como pedido. É temporário e tem duas limitações conhecidas: não
acompanha o usuário em outro aparelho e se perde ao limpar os dados do navegador. A troca
para o banco é descrita na seção 5 e **mexe em um único arquivo** (`src/lib/painel-layout.ts`),
porque o componente só conhece a interface `carregarOrdem`/`salvarOrdem`/`limparOrdem`.

## 5. Proposta de persistência no banco (para aprovação — NÃO EXECUTADA)

### 5.1 Estrutura recomendada: tabela dedicada

```sql
-- PROPOSTA: não executar antes da aprovação do solicitante.
CREATE TABLE public.painel_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tela text NOT NULL,                          -- 'inicio', 'financeiro', 'estoque'...
  ordem jsonb NOT NULL DEFAULT '[]'::jsonb,    -- ['alertas','indicadores',...]
  ocultos jsonb NOT NULL DEFAULT '[]'::jsonb,  -- reservado para "ocultar bloco" (fase futura)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT painel_layouts_user_tela_key UNIQUE (user_id, tela)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.painel_layouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.painel_layouts TO service_role;

ALTER TABLE public.painel_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY painel_layouts_select ON public.painel_layouts
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY painel_layouts_insert ON public.painel_layouts
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY painel_layouts_update ON public.painel_layouts
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY painel_layouts_delete ON public.painel_layouts
FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_painel_layouts_updated_at
BEFORE UPDATE ON public.painel_layouts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

Notas de segurança:

- nenhuma concessão para `anon` — preferência de tela é dado do usuário autenticado;
- cada política exige `auth.uid() = user_id`, então ninguém lê nem escreve a ordem de outro
  usuário, nem a de outro tenant;
- não há `organization_id`: a preferência é pessoal, e a chave é o próprio usuário;
- o `service_role` recebe acesso apenas para manutenção/administração, nunca no cliente.

### 5.2 Alternativa considerada e não recomendada

Criar uma coluna `painel_layouts jsonb` em `public.profiles`. Funcionaria com as políticas já
existentes e evitaria uma tabela, mas mistura dado cadastral do usuário com preferência de
interface e obriga a ler/gravar a linha inteira de perfil a cada arrasto. Se a preferência
crescer (blocos ocultos, ordem por módulo, por papel), a coluna vira um depósito difícil de
consultar. A tabela dedicada é mais simples de evoluir e de auditar.

### 5.3 Troca no código (quando aprovado)

`src/lib/painel-layout.ts` passa a ler e gravar em `painel_layouts` (upsert por
`user_id` + `tela`), mantendo as mesmas assinaturas usadas pelo `PainelOrdenavel`. O
`localStorage` continua apenas como cache local, se quisermos resposta instantânea.

## 6. Telas candidatas, em ordem sugerida

| Ordem | Tela | Blocos que fariam sentido | Observação |
|---|---|---|---|
| 1 | Início | indicadores, faturamento/resumo, alertas, OS e atividades | **protótipo desta rodada** |
| 2 | Financeiro | indicadores, contas a receber, contas a pagar, lançamentos | mesma estrutura de blocos empilhados |
| 3 | Estoque | indicadores, filtros, tabela | |
| 4 | Vendas / Orçamentos / Clientes / Contas a pagar | indicadores e os cartões de apoio | telas com KPIs no topo |
| 5 | Painel do Técnico | fila, resumo, atrasadas/comissões, analíticos | **o kanban fica de fora**: ali arrastar grava status |
| — | Oficina ao Vivo | — | painel de TV com layout fixo; não personalizável |

Ficam explicitamente **fora** da personalização: colunas de kanban, ordem de linhas de
tabela, ordem de itens de uma lista de dados e qualquer bloco cuja posição mude o sentido da
leitura (por exemplo, a trilha de status de uma OS).

## Decisões de UX

- **Somente visual, nunca dado:** o arrasto de organização não chama nenhuma gravação de
  registro. Onde arrastar precisa gravar (status da OS), é outro mecanismo, com validação,
  como no painel do técnico.
- **Puxador explícito com o nome do bloco:** além de resolver o toque, deixa claro o que
  está sendo movido e evita arrasto acidental.
- **Padrão sempre recuperável:** "Restaurar padrão" aparece assim que a ordem fica diferente,
  e a ordem volta a ser limpa quando o usuário retorna ao padrão.
- **Bloco novo nunca some:** a ordem salva é normalizada contra os blocos atuais.
- **Teclado e leitor de tela:** ↑/↓ no puxador, com anúncio da nova posição.
- **Sem animação de "entrada":** o arrasto só destaca o bloco e a posição; nada de movimento
  decorativo, alinhado à regra de `prefers-reduced-motion` do projeto.

## Testes executados

| Item | Resultado |
|---|---|
| `npm run test` (Vitest) | **Não executado** — este ambiente não expõe terminal |
| Build / lint | **Não executados** pelo mesmo motivo |
| Testes escritos | `src/lib/painel-layout.test.ts` cobre `moverItem` (mover para cima, para baixo, mesma posição, índice inválido, lista vazia) e `normalizarOrdem` (id inexistente, id novo, conteúdo inválido, repetição). **Foram escritos, não executados** |
| Verificação feita | Leitura dos arquivos alterados e conferência de que os quatro blocos do Início continuam com a mesma marcação, apenas envolvidos pelo componente |

Não declaro nenhuma execução de teste que não tenha ocorrido.

## Validação manual

| Item | Resultado |
|---|---|
| Viewport testado | **Não aplicável** — o ambiente não abre o app; a validação é do solicitante, no preview |
| Perfis testados | **Não aplicável** nesta rodada (a preferência é por usuário, sem regra de perfil) |
| Roteiro sugerido de teste | 1) arrastar "Indicadores" para baixo e recarregar a página (a ordem deve permanecer); 2) mover com ↑ ↓ pelo teclado; 3) usar "Restaurar padrão"; 4) testar no celular, arrastando pelo puxador sem rolar a página; 5) entrar com outro usuário e confirmar que a ordem dele é independente |

## Riscos e limitações

- **É um protótipo.** O aviso "Seu painel: arraste pelos pontos..." e os puxadores ficam
  visíveis o tempo todo. Se a decisão for por um modo "Personalizar", essa linha vira um
  botão que liga o modo e os puxadores só aparecem nele — mudança pequena, concentrada no
  componente.
- **Espaçamento levemente diferente:** os blocos passaram a ser filhos de um contêiner com
  `space-y-4 lg:space-y-5` (antes eram filhos diretos de `space-y-5 lg:space-y-6`). Nada
  além disso mudou na composição visual do Início.
- **`localStorage` não acompanha o usuário em outro aparelho** e some se os dados do
  navegador forem limpos. Resolvido pela tabela proposta.
- **Sem rolagem automática** durante o arrasto: em telas longas, mover um bloco para muito
  longe exige soltar, rolar e continuar. Dá para implementar depois, se o uso pedir.
- **Custo de suporte:** com layout livre, tutoriais e capturas de tela deixam de bater com a
  tela do usuário. É o principal argumento para manter **bons padrões por papel** e tratar a
  personalização como camada opcional.
- **Não há como ocultar blocos** nesta rodada: só reordenar. O campo `ocultos` já está
  previsto na proposta de tabela, mas esconder bloco precisa da regra de permissão definida
  antes (não pode esconder/mostrar dado bloqueado).
- **Interação com o relatório do `KpiCard`:** a personalização não substitui a padronização
  visual pendente (Tarefa 3 do plano). Layout livre sobre componentes divergentes multiplica
  a variação; a ordem recomendada continua sendo padronizar primeiro.
- **Nenhuma mudança de banco, RLS, cálculo, fiscal ou permissão** foi feita nesta rodada.

## Commit

- **Mensagem sugerida:** `feat(ui): protótipo de painel reorganizável por usuário no Início`
- **Hash:** criado automaticamente ao final desta rodada; este ambiente não lê o histórico,
  então o hash deve ser obtido do `git log`.

## Próximo passo recomendado

**Avaliar o protótipo no preview** e responder duas perguntas: (a) arrastar sempre ativo ou
somente em um modo "Personalizar"; (b) aprovar ou ajustar a estrutura de banco da seção 5.
Com as duas respostas, a rodada seguinte tem duas opções pequenas e independentes:

1. **Trocar a persistência** de `localStorage` para `painel_layouts` (um arquivo de código +
   a migração aprovada); ou
2. **Levar o mecanismo para a próxima tela** (Financeiro), ainda com persistência local,
   para ampliar a avaliação antes de fixar o modelo no banco.
