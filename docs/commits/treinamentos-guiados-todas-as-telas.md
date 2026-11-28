# Treinamentos guiados para todas as telas do sistema

Data: 2026-11-28
Pedido: "quero passeio guiado de tudo".

Antes desta rodada existiam 8 passeios guiados (dashboard, OS, estoque, clientes, financeiro,
comissões, pedidos de compra, painel do técnico). Agora **todas as telas do menu** têm o seu.

## Como o passeio guiado funciona

1. O artigo da Central de Ajuda (`public.wiki_articles`) guarda `tour_target_route` (rota onde o
   treinamento acontece) e `tour_steps` (lista de passos, cada um com título, texto, alvo e
   posicionamento).
2. O alvo de cada passo é uma âncora estável no DOM: `[data-tour="..."]` para os blocos que
   criamos nesta rodada e `[data-bloco="..."]` para os painéis que já existiam.
3. O `HelpTourRunner` navega até a rota, espera os alvos e destaca um por um. Passos com alvo
   ausente são pulados e o usuário é avisado; a conclusão só é gravada se algum destaque apareceu.

## Telas cobertas nesta rodada (rota → artigo)

| Tela | Rota | Artigo (slug) |
| --- | --- | --- |
| Orçamentos | `/orcamentos` | `guia-orcamentos` |
| Serviços | `/servicos` | `guia-servicos` |
| Fornecedores | `/fornecedores` | `guia-parceiros` |
| Transportadoras | `/transportadoras` | `guia-transportadoras` |
| Oficina ao Vivo | `/workshop/live` | `guia-oficina-ao-vivo` |
| Checklist de OS | `/admin/configuracao-os` | `guia-checklist-os` |
| Ferramentas e Equipamentos | `/patrimonio` | `guia-patrimonio` |
| Meu Estoque | `/meu-estoque` | `guia-meu-estoque` |
| Itens para Demonstração | `/demonstracoes` | `guia-demonstracoes` |
| Importar XML de NF-e | `/estoque/importar-xml` | `guia-importar-xml` |
| PDV | `/pdv` | `guia-pdv` |
| Vendas | `/vendas` | `guia-vendas` |
| Notas Fiscais | `/fiscal/notas` | `guia-notas-fiscais` |
| NF-e de venda | `/fiscal/nfe/venda` | `guia-nfe-venda` |
| NFS-e | `/fiscal/nfse` | `guia-nfse` |
| Devolução de venda | `/fiscal/nfe/devolucao-venda` | `guia-devolucao-venda` |
| Devolução de compra | `/fiscal/nfe/devolucao-compra` | `guia-devolucao-compra` |
| NF-e complementar (em breve) | `/fiscal/nfe/complementar` | `guia-nfe-complementar` |
| Contas a Pagar | `/contas-pagar` | `guia-contas-pagar` |
| Cobranças | `/cobrancas` | `guia-cobrancas` |
| Relatórios | `/relatorios` | `guia-relatorios` |
| Meu Financeiro (técnico) | `/technician/financeiro` | `guia-financeiro-tecnico` |
| Equipe | `/equipe` | `guia-equipe` |
| Permissões | `/permissoes` | `guia-permissoes` |
| Empresa e fiscal | `/empresa` | `guia-empresa` |
| Configurações | `/configuracoes` | `guia-configuracoes` |
| Auditoria | `/auditoria` | `guia-auditoria` |
| Assinatura | `/assinatura` | `guia-assinatura` |
| Central de Ajuda | `/wiki` | `guia-central-de-ajuda` |
| Suporte | `/suporte` | `guia-suporte` |
| Notificações | `/notificacoes` | `guia-notificacoes` |

Total: 30 treinamentos novos (o sistema passa a ter 38 passeios guiados).

## Âncoras adicionadas (`data-tour`)

Somente em elementos DOM (h1, header, div, label, section). **Não** foi usada âncora em componente
React (`PremiumCard`, `AlertBox`, `Button`, `Input`): nesses casos o atributo não passa no
type-check, então o passo aponta para o bloco que o contém ou para o topo da tela.

- `src/pages/WorkshopLive.tsx` → `workshop-live-page`
- `src/pages/Equipe.tsx` → `equipe-page`
- `src/pages/Permissoes.tsx` → `permissoes-page`
- `src/pages/EmpresaConfig.tsx` → `empresa-page`
- `src/pages/Configuracoes.tsx` → `configuracoes-page`
- `src/pages/ConfiguracaoOS.tsx` → `checklist-os-page`
- `src/pages/Assinatura.tsx` → `assinatura-page`
- `src/pages/Auditoria.tsx` → `auditoria-page`
- `src/pages/Relatorios.tsx` → `relatorios-page`
- `src/pages/Notificacoes.tsx` → `notificacoes-page`
- `src/pages/Suporte.tsx` → `suporte-page`
- `src/pages/Wiki.tsx` → `wiki-page`
- `src/pages/ImportarXmlNfe.tsx` → `importar-xml-page`, `importar-xml-upload`
- `src/pages/NovaNfse.tsx` → `nfse-page`
- `src/pages/PDV.tsx` → `pdv-topo`, `pdv-itens`
- `src/pages/Vendas.tsx` → `vendas-page`
- `src/pages/Servicos.tsx` → `servicos-page`
- `src/pages/Patrimonio.tsx` → `patrimonio-page` (serve `/patrimonio` e `/meu-estoque`)
- `src/pages/Demonstracoes.tsx` → `demonstracoes-page`
- `src/pages/ContasPagar.tsx` → `contas-pagar-page`
- `src/pages/Cobrancas.tsx` → `cobrancas-page`
- `src/pages/TechnicianFinancialDashboard.tsx` → `financeiro-tecnico-page`
- `src/pages/fiscal/NfeVenda.tsx` → `nfe-venda-page`
- `src/pages/fiscal/DevolucaoVenda.tsx` → `devolucao-venda-page`
- `src/pages/fiscal/DevolucaoCompra.tsx` → `devolucao-compra-page`
- `src/pages/fiscal/NfeComplementar.tsx` → `nfe-complementar-page`
- `src/components/cadastros/ParceirosPage.tsx` → `parceiros-page` (serve fornecedores e transportadoras)

Nas telas que já tinham `data-bloco` (orçamentos, serviços, notas fiscais, contas a pagar,
cobranças, relatórios, patrimônio, demonstrações, vendas, dashboard, financeiro, técnico), os
passos usam esses blocos — nada novo foi criado dentro do conteúdo delas.

## Categorias da Central de Ajuda criadas

`Cadastros`, `Vendas e Notas`, `Patrimônio e Demonstração`, `Ajuda e Suporte` (as telas de
financeiro, estoque, OS, orçamentos e configurações usam as categorias existentes).

## Observações

- `NF-e complementar` está "Em breve" no sistema: o guia explica a situação e aponta as
  alternativas prontas (devoluções e consulta em Notas Fiscais).
- Telas restritas (auditoria, equipe, permissões, assinatura, patrimônio) só abrem para
  administradores — o passeio é o mesmo, mas a rota pode redirecionar quem não tem permissão.
- Nada foi alterado em cálculos, filtros de organização, RLS, permissões ou valores.

## Correção de formatação (mesma sessão)

Os textos dos guias apareciam sem formatação: títulos gigantes, tabelas sem borda e listas sem
marcadores. Causa: o corpo do artigo usava as classes `prose` do Tailwind Typography, mas o plugin
`@tailwindcss/typography` está instalado e **não** habilitado no `tailwind.config.ts` — as classes
não geravam nenhum estilo.

Correções:

- `src/components/help/GuiaMarkdown.tsx` (novo): renderiza o markdown com estilos explícitos de
  Tailwind para títulos (h1/h2/h3/h4), parágrafos, negrito, links, listas com marcador, código,
  citação, linha horizontal, imagens, iframe e **tabelas** (cabeçalho em `bg-muted`, bordas e
  rolagem horizontal em telas pequenas). Usa só tokens de tema, funcionando em claro e escuro.
- `src/pages/Wiki.tsx`: passou a usar o `GuiaMarkdown`; as classes `prose` foram removidas (não
  faziam efeito) e as importações de `react-markdown`/`remark-gfm` saíram do arquivo.
- `src/components/help/HelpTourRunner.tsx`: o botão de avançar aparecia em inglês ("Next (2 of 9)").
  Foram adicionados os rótulos de progresso em português (`nextWithProgress`,
  `lastWithProgress`, `skipWithProgress`, `open`) e o balão do passeio ganhou largura fixa,
  cantos arredondados, título e texto em tamanhos próprios e botões alinhados à direita.
- Os destaques mais longos dos passeios antigos (OS, Estoque, Pedidos de Compra, Painel do
  Técnico) foram reescritos em frases curtas, para caberem no balão sem parecer um bloco de texto.

## Treinamento "mão na massa": cria um registro de exemplo

Depois de explicar a tela, o passeio continua dentro do formulário: o sistema abre o cadastro,
destaca campo por campo, diz o que preencher e já deixa um exemplo digitado — o usuário só confere
e salva (e depois pode apagar o registro de teste).

Como funciona (`src/components/help/HelpTourRunner.tsx`):

- Cada passo pode trazer um `data` (JSON no banco, sem código): `abrir` (seletor do botão "Novo",
  clicado antes do passo aparecer), `exemplo` (valor aplicado no próprio campo destacado) e
  `campos` (vários campos de uma vez). O runner converte esses dados em hook `before` do
  react-joyride; o diálogo abre e o alvo é encontrado dentro de `targetWaitTimeout`.
- Preencher campo controlado do React exige o setter nativo + eventos `input`/`change` — o valor
  digitado por `campo.value = x` seria ignorado pelo formulário.
- Passos dentro do formulário usam `hideOverlay: true`: sem o overlay, o usuário consegue digitar,
  escolher em Selects (a lista abre em portal, fora do destaque) e rolar o formulário. O overlay
  continua nas etapas de explicação da tela, mantendo o destaque escurecido.
- Seletores usados, em ordem de preferência: `[data-tour="..."]`; `#id-do-formulário` (ex.:
  `#cliente-form`); `input[placeholder="..."]`; `button[form="id-do-formulário"]` para o botão
  Salvar; `[role="dialog"]` quando o diálogo não tem id.

Telas com o fluxo completo (explicação + criação de exemplo): **Clientes**, **Serviços**,
**Orçamentos**, **Contas a Pagar** e **Itens para Demonstração**.

Âncoras novas para esse fluxo: `servicos-novo`, `servico-descricao`, `servico-preco`,
`contas-pagar-nova`, `orcamentos-novo`, `demonstracoes-nova`, `demonstracao-busca`,
`demonstracao-obs`, `demonstracao-gerar`.

Pendentes de "mão na massa": Estoque (novo produto), Fornecedores/Transportadoras, Ordens de
Serviço, Vendas, PDV, Pedidos de Compra, Notas Fiscais/NFS-e, Equipe, Cobranças, Ferramentas e
Equipamentos, Suporte e Checklist de OS.

## Como testar

1. Abra Central de Ajuda (`/wiki`) e busque por uma tela, por exemplo "PDV".
2. Entre no artigo: confira os títulos em tamanho de seção, a tabela com cabeçalho e bordas e as
   listas com marcadores.
3. Inicie o passeio guiado: a rota é aberta, cada área é destacada e o rodapé mostra
   "Próximo (2 de 9)" em português.
4. Confira se o rodapé do passeio avisa quando um passo é pulado (alvo ausente).
