# Painel personalizável em todas as telas

Continuação do protótipo aprovado na tela Início (`PainelOrdenavel`). Nesta rodada o mesmo
painel foi aplicado às telas operacionais do sistema.

## Regra que continua valendo

- A ordem é **somente visual**: nada grava em registro de negócio. Fica salva por **usuário**
  e por **tela** (`livreos:painel:<userId>:<tela>`, via `src/lib/painel-layout.ts`).
- Cada bloco participante é um **filho direto** de `<PainelOrdenavel>` com `data-bloco` (id
  estável) e `data-rotulo` (nome no puxador).
- **Cabeçalho, barras de ação e diálogos ficam fora** do painel: nada de arrastar modal.
- Exceção de escrita: o kanban do painel do técnico continua sendo a única superfície que
  altera status de OS (`src/lib/os-status-update.ts`). Ele fica **fora** do painel.

## Telas com painel personalizável

| Tela | `tela` | Blocos ordenáveis |
| --- | --- | --- |
| Início | `inicio` | indicadores, faturamento, alertas, OS e atividades recentes |
| Financeiro | `financeiro` | indicadores, busca, transações recentes |
| Contas a Pagar | `contas-pagar` | indicadores, busca e filtros, lista de contas |
| Vendas | `vendas` | indicadores, vendas/ganhos/notas |
| Orçamentos | `orcamentos` | indicadores, busca, lista |
| Clientes | `clientes` | indicadores, busca e lista |
| Estoque | `estoque` | indicadores, busca e filtros, inventário |
| Serviços | `servicos` | busca, catálogo |
| Ordens de Serviço | `ordens-servico` | indicadores, lista de OS |
| Cobranças | `cobrancas` | indicadores, busca e lista |
| Relatórios | `relatorios` | fechamento do dia, análises do período, relatório personalizado |
| Demonstrações | `demonstracoes` | indicadores, filtro e registros |
| Patrimônio | `patrimonio` | indicadores, ferramentas e equipamentos |
| Notas Fiscais | `notas-fiscais` | filtros, notas emitidas |
| Auditoria | `auditoria` | filtros, registros |
| Meu Painel (técnico) | `tecnico` | próxima OS da fila, resumo financeiro, OS atrasadas e comissões |
| Painel Financeiro (técnico) | `tecnico-financeiro` | chave PIX, totais do período, situações, comissão por dia, extrato, faturas, despesas |

## Fora do painel (e por quê)

- **Telas de bloco único de conteúdo** — arrastar não acrescenta nada: Comissões,
  Pedidos de Compra, Notificações, Equipe, Suporte, Importar XML de NF-e, Nova NFS-e,
  Permissões, Wiki.
- **Telas de formulário/configuração** — o conteúdo é um formulário de fluxo único:
  Configurações, Configuração de OS, Empresa, Assinatura, Nova Venda (assistente),
  PDV, devoluções/complementares de NF-e.
- **Fixas por decisão de produto** — Oficina ao Vivo (painel de TV), Admin Master,
  Login/Cadastro, Landing.
- **Pendente técnico** — Fornecedores e Transportadoras (`src/components/cadastros/ParceirosPage.tsx`):
  o JSX está escrito em linhas únicas muito longas, o que torna a marcação por bloco arriscada
  por edição pontual. Precisa de uma pequena quebra de linhas antes de receber o painel.
