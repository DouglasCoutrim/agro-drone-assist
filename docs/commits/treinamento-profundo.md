# Treinamentos guiados profundos (item por item) + mapa do sistema

## Objetivo

Os treinamentos existentes eram superficiais: 3 a 4 destaques por tela e um texto curto. Pedido:
ensinar a fundo, item por item, menu por menu, função por função.

## O que mudou

### Âncoras novas nas telas (`data-tour`)

Cada destaque de treinamento usa um atributo `data-tour` (não depende de CSS, que muda com o layout):

- **Dashboard** (`Index.tsx`): `dashboard-acoes`, `dashboard-kpi-0..3` (um por indicador),
  `dashboard-os`, `dashboard-alertas`, `dashboard-kpis` (bloco).
- **Ordens de Serviço**: `os-nova`, `os-agrupar`, `os-busca`, `os-filtros`, `os-lista`.
- **Clientes**: `clientes-novo`, `clientes-csv`, `clientes-busca`, `clientes-lista`.
- **Estoque**: `estoque-novo`, `estoque-xml`, `estoque-fotos`, `estoque-csv`,
  `estoque-indicadores`, `estoque-filtros`, `estoque-baixo`.
- **Financeiro**: `financeiro-nova`, `financeiro-cobrar`, `financeiro-os-abertas`.
- **Compras** (`PedidosCompra.tsx`): `compras-page`, `compras-novo`, `compras-abas`.
- **Comissões**: `comissoes-abas`, `comissoes-resumo`, `comissoes-busca`, `comissoes-faturas`.
- **Meu Painel (técnico)**: `tecnico-topo`, `tecnico-kanban`.

Onde o destaque é um **componente** (PremiumCard, AlertBox), ele é envolvido em um `<div data-tour="...">`
porque TypeScript não deixa passar `data-*` para componentes.

### Guias reescritos e ampliados (`wiki_articles.content`)

Cada guia agora explica a tela **campo por campo**, com tabelas de "item → para que serve":

| Guia | Destaques no tour |
| --- | --- |
| Bem-vindo ao LivreOS (Dashboard) | 9 |
| Ordens de Serviço: da abertura à entrega | 9 |
| Estoque: cadastro, entradas, saídas e alertas | 9 |
| Clientes: cadastro completo e CRM | 6 |
| Financeiro: caixa, transações e cobranças | 7 |
| Pedidos de Compra: da solicitação à cotação | 7 |
| Comissões: faturas de saque e conferência | 6 |
| Meu Painel: o dia a dia do técnico | 7 |

### Guias novos

- **Mapa do sistema: cada menu e para que serve** — percorre as oito áreas do menu (Início,
  Atendimento, Cadastros, Estoque, Vendas e Notas, Financeiro, Configurações, Ajuda) item por item,
  mais as telas que existem fora do menu (`/technician/financeiro` e `Nova NF-e` pela venda) e uma
  sugestão de ordem de configuração inicial.
- **Categoria "Compras"** criada na Central de Ajuda para agrupar o guia de Pedidos de Compra.

## Observações técnicas

- Os passos que apontam para abas não ativas (Compras, Comissões) ficam no próprio seletor de abas, com
  o texto explicando o que há em cada aba: conteúdo de aba inativa não existe no DOM, então não há o que
  destacar.
- Formulários que só existem dentro de diálogos (cadastro de OS, de item, de cliente) são ensinados no
  texto do guia, seção por seção, porque o tour roda na tela de lista.
- Continua valendo a proteção anterior: se um destaque não existir na tela, o passo é pulado e o
  treinamento não é marcado como visto sem ter mostrado nada.

## Ainda sem treinamento guiado

Oficina ao Vivo, Orçamentos, Fornecedores, Transportadoras, Serviços, Meu Estoque, Itens para
Demonstração, Patrimônio, PDV, Pedidos de Venda, Notas Fiscais/NF-e/NFS-e, Contas a Pagar, Cobranças,
Relatórios, Equipe, Empresa e fiscal, Configurações gerais, Checklist de OS, Auditoria, Notificações,
Suporte e Meu Financeiro.
