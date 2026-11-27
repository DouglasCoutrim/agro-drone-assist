# Relatório — glossário de módulos e nomenclatura do LivreOS

> Documento de **Fase 0** do *Plano de melhoria de UI/UX do LivreOS* (Tarefa 2 da seção 15),
> na sequência do inventário em
> `docs/commits/inventario-rotas-menu-permissoes-e-entradas-contextuais.md`.
> **Somente documentação:** nenhum rótulo de menu, título de tela, rota, permissão ou estilo
> foi alterado por este arquivo. O glossário **define** os nomes oficiais; **aplicá-los** é
> uma tarefa posterior, uma por commit.

## Baseline

- **Commit analisado:** `2555c76f667fb9dd170659c194b0064758acaeb0` (commit do inventário,
  imediatamente anterior a esta rodada).
- **Branch:** a mesma do ambiente de trabalho atual (o agente não cria branches aqui).
- **Escopo:** definir e documentar o glossário de módulos e nomenclatura, sem alterar o app.

## Objetivo

O inventário registrou a divergência **D13** — "Nomenclatura ainda técnica ou ambígua" — e o
plano a classifica como **P1**. Esta rodada resolve o problema na camada de decisão: define
os módulos oficiais do produto, o nome oficial de cada tela e o significado de cada termo,
para que a revisão do menu e dos títulos seja aplicada depois **sem improviso e sem criar
uma segunda nomenclatura**.

O glossário parte da tarefa do usuário, não da estrutura interna nem do documento fiscal,
e trata o LivreOS como **plataforma operacional modular** (comércio, serviços e operações
internas), na qual OS, assistência técnica, técnico em campo, equipamentos, checklists e
oficina são **módulos opcionais**.

## Arquivos alterados

| Arquivo | Motivo |
|---|---|
| `docs/commits/glossario-modulos-e-nomenclatura.md` (novo) | Único arquivo desta rodada |

Nenhum arquivo de código foi alterado.

## Arquivos analisados (somente leitura)

`src/components/layout/navConfig.ts`; `src/components/layout/Sidebar.tsx`;
`src/components/layout/BottomNav.tsx`; `src/components/layout/PlatformSidebar.tsx`;
`src/components/layout/Header.tsx`; `src/components/layout/openSearch.ts`;
`src/components/team/PermissionTree.tsx`; `src/components/cadastros/ParceirosPage.tsx`;
`src/components/fiscal/fiscalShared.tsx`; `src/pages/Equipe.tsx` (rótulos de papel e de
permissão); `src/pages/Index.tsx`; `src/pages/OrdensServico.tsx`; `src/pages/Orcamentos.tsx`;
`src/pages/PDV.tsx`; `src/pages/Vendas.tsx`; `src/pages/Estoque.tsx`;
`src/pages/Patrimonio.tsx`; `src/pages/Demonstracoes.tsx`; `src/pages/PedidosCompra.tsx`;
`src/pages/ImportarXmlNfe.tsx`; `src/pages/fiscal/*`; `src/pages/NovaNfse.tsx`;
`src/pages/Financeiro.tsx`; `src/pages/ContasPagar.tsx`; `src/pages/Comissoes.tsx`;
`src/pages/Cobrancas.tsx`; `src/pages/Relatorios.tsx`; `src/pages/ConfiguracaoOS.tsx`;
`src/pages/EmpresaConfig.tsx`; `src/pages/Configuracoes.tsx`; `src/pages/Permissoes.tsx`;
`src/pages/Auditoria.tsx`; `src/pages/TechnicianDashboard.tsx`;
`src/pages/TechnicianFinancialDashboard.tsx`; `src/pages/WorkshopLive.tsx`;
`src/pages/Wiki.tsx`; `src/pages/Suporte.tsx`; `src/pages/Notificacoes.tsx`;
`src/pages/Assinatura.tsx`; `src/pages/AdminMaster.tsx`; `src/pages/Landing.tsx`.

## O que foi feito

1. Definição dos **princípios de nomenclatura** do produto (seção 1).
2. Definição dos **módulos oficiais** — núcleo comum e módulos opcionais — com o que entra
   em cada um (seção 2).
3. **Nome oficial de cada tela**, confrontado com o nome atual no menu e com o título
   atualmente renderizado na página (seção 3).
4. **Glossário de termos** de uso transversal, com o significado e o que cada termo **não**
   é (seção 4).
5. **Termos a evitar**, com o substituto oficial (seção 5).
6. Levantamento das ocorrências que fixam **identidade de oficina/drones** (seção 6).
7. Registro de **18 conflitos de nomenclatura** (N1 a N18), com evidência por arquivo
   (seção 7), sem corrigir nenhum.
8. Definição da regra de aplicação: **renomear rótulos e títulos, nunca as URLs** (seção 8).

## 1. Princípios de nomenclatura

1. **Nome pela tarefa, não pela estrutura.** "Vendas", não "Pedidos de Venda"; "PDV", não
   "Nova Venda (PDV)".
2. **Um conceito, um nome, em todas as telas.** Se a tela é "Estoque", o menu também diz
   "Estoque".
3. **Termo fiscal só quando for fiscal.** NF-e, NFS-e e XML ficam no módulo Fiscal; não
   nomeiam a venda nem o cadastro de produto.
4. **Sem parênteses de contexto no menu.** "(técnico)", "(TV)" e "(serviço)" saem do rótulo;
   o contexto pertence à própria tela.
5. **A identidade é do negócio do cliente, não da oficina.** O produto não é "sistema de
   drones" nem "sistema de oficina".
6. **URL é contrato, rótulo é apresentação.** Nenhuma rota muda de caminho: as URLs já estão
   impressas em etiquetas com QR code, salvas em favoritos e usadas em links de comunicados.

## 2. Módulos oficiais

### 2.1 Núcleo comum (sempre presente)

| Módulo | O que entra | Telas atuais |
|---|---|---|
| Início | Visão do dia, o que exige ação, atalhos | `/dashboard` |
| Vendas | Venda rápida e histórico de vendas | `/pdv`, `/vendas` |
| Clientes | Cadastro e histórico do cliente | `/clientes` |
| Estoque | Produtos, peças, materiais e movimentações | `/estoque`, `/estoque/importar-xml` |
| Financeiro | Contas a receber, contas a pagar, cobranças, comissões | `/financeiro`, `/contas-pagar`, `/cobrancas`, `/comissoes` |
| Relatórios | Análises gerenciais e fechamentos | `/relatorios` |
| Configurações | Empresa, equipe, permissões, checklist, auditoria | `/empresa`, `/equipe`, `/permissoes`, `/configuracoes`, `/admin/configuracao-os`, `/auditoria` |
| Ajuda | Central de Ajuda, suporte, notificações | `/wiki`, `/wiki/:slug`, `/suporte`, `/notificacoes` |

### 2.2 Módulos opcionais (ativáveis por segmento e plano)

| Módulo | O que entra | Telas atuais |
|---|---|---|
| Atendimento | Ordens de serviço e orçamentos | `/ordens-servico`, `/orcamentos` |
| Assistência técnica | Equipamentos, diagnóstico, peças, checklist de revisão | `/admin/configuracao-os` e as partes de equipamento/checklist da OS |
| Operação de campo | Painel do técnico, agenda, execução, financeiro do técnico | `/technician/dashboard`, `/technician/financeiro` |
| Painel de produção | Exibição em TV do andamento | `/workshop/live` |
| Fiscal | Emissão, acompanhamento, devolução e complemento de documentos fiscais | `/fiscal/notas`, `/fiscal/nfe/venda`, `/fiscal/nfe/devolucao-venda`, `/fiscal/nfe/devolucao-compra`, `/fiscal/nfe/complementar`, `/fiscal/nfse` |
| Compras e fornecedores | Pedidos de compra, fornecedores, transportadoras | `/compras`, `/fornecedores`, `/transportadoras` |
| Patrimônio e estoque do técnico | Ferramentas, equipamentos e estoque em posse do técnico | `/patrimonio`, `/meu-estoque` |
| Demonstrações | Itens cedidos para demonstração | `/demonstracoes` |
| Serviços | Catálogo de serviços oferecidos | `/servicos` |
| Assinatura | Plano contratado, limites e cobrança da própria conta | `/assinatura` |

### 2.3 Relação com as seções de menu atuais

| Seção atual (`navConfig.ts`) | Destino no glossário |
|---|---|
| Início | Início (com "Meu Painel" e "Oficina ao Vivo" saindo para módulos opcionais) |
| Atendimento | Módulo opcional Atendimento (nome mantido; ver N1) |
| Cadastros | Dissolvida: Clientes em Clientes; Fornecedores e Transportadoras em Compras e fornecedores; Serviços em Serviços |
| Estoque | Estoque + módulos opcionais Compras e fornecedores, Patrimônio, Demonstrações |
| Vendas e Notas | Dividida em Vendas e Fiscal (ver N13) |
| Financeiro | Financeiro + Relatórios |
| Configurações | Configurações |
| Ajuda | Ajuda |

## 3. Nome oficial de cada tela

`Título atual` = texto hoje renderizado na página (com evidência na seção 7 quando divergir
do menu). `Nome oficial proposto` é a decisão do glossário; **aplicar é tarefa posterior**.

| Rota | Seção atual | Nome no menu hoje | Título atual na tela | Nome oficial proposto | Tarefa do usuário |
|---|---|---|---|---|---|
| `/dashboard` | Início | Dashboard | Visão geral (desktop) / "Olá, {nome}!" (celular) | Início | Ver o que exige ação hoje |
| `/ordens-servico` | Atendimento | Ordens de Serviço | Ordens de Serviço | Ordens de serviço (Atendimento) | Registrar e acompanhar atendimentos |
| `/orcamentos` | Atendimento | Orçamentos | Orçamentos | Orçamentos | Enviar e aprovar orçamentos |
| `/pdv` | Vendas e Notas | Nova Venda (PDV) | PDV — Nova venda | PDV | Registrar uma venda agora |
| `/vendas` | Vendas e Notas | Pedidos de Venda | Vendas | Vendas | Consultar e gerenciar vendas |
| `/fiscal/notas` | Vendas e Notas | Notas Fiscais | Notas Fiscais | Notas emitidas (Fiscal) | Acompanhar e corrigir documentos fiscais |
| `/fiscal/nfe/venda` | Vendas e Notas | NF-e de venda | NF-e de venda | Emitir NF-e de venda (Fiscal) | Emitir a nota de uma venda registrada sem nota |
| `/fiscal/nfe/devolucao-venda` | Vendas e Notas | Devolução de venda | Devolução de venda | Devolução de venda (Fiscal) | Registrar devolução do cliente |
| `/fiscal/nfe/devolucao-compra` | Vendas e Notas | Devolução de compra | Devolução de compra | Devolução de compra (Fiscal) | Registrar devolução ao fornecedor |
| `/fiscal/nfe/complementar` | (sem menu) | — | NF-e complementar | NF-e complementar (Fiscal) | Complementar valores ou impostos |
| `/fiscal/nfse` | Vendas e Notas | Nova NFS-e (serviço) | Nova NFS-e | Emitir NFS-e (Fiscal) | Emitir nota de serviço |
| `/clientes` | Cadastros | Clientes | Clientes | Clientes | Cadastrar e consultar clientes |
| `/fornecedores` | Cadastros | Fornecedores | Fornecedores | Fornecedores | Cadastrar e consultar fornecedores |
| `/transportadoras` | Cadastros | Transportadoras | Transportadoras | Transportadoras | Cadastrar e consultar transportadoras |
| `/servicos` | Cadastros | Serviços | Serviços | Serviços | Manter o catálogo de serviços |
| `/estoque` | Estoque | Produtos e Peças | Estoque | Estoque | Consultar e movimentar o estoque |
| `/estoque/importar-xml` | Estoque | Importar XML (NF-e) | Importar XML de NF-e | Importar XML de NF-e | Entrar com produtos a partir do XML |
| `/compras` | Estoque | Pedidos de Compra | Pedidos de Compra | Compras | Solicitar e acompanhar compras |
| `/demonstracoes` | Estoque | Itens para Demonstração | Itens para Demonstração | Itens em demonstração | Controlar itens cedidos para demonstração |
| `/patrimonio` | Estoque | Ferramentas e Equipamentos | Ferramentas e Equipamentos | Patrimônio | Controlar ferramentas e equipamentos |
| `/meu-estoque` | Estoque | Meu Estoque (técnico) | Meu Estoque | Meu estoque | Ver o que está comigo |
| `/financeiro` | Financeiro | Financeiro | Financeiro | Financeiro | Ver a situação financeira |
| `/contas-pagar` | Financeiro | Contas a Pagar | Contas a Pagar | Contas a pagar | Registrar e pagar despesas |
| `/cobrancas` | Financeiro | Cobranças | Cobranças | Cobranças | Cobrar clientes |
| `/comissoes` | Financeiro | Comissões | Comissões | Comissões | Apurar comissões da equipe |
| `/relatorios` | Financeiro | Relatórios | Relatórios | Relatórios | Analisar resultados |
| `/equipe` | Configurações | Equipe | Gerenciamento de Equipe | Equipe | Gerenciar pessoas e acessos |
| `/permissoes` | (sem menu) | — | Permissões de OS | Permissões de OS | Definir quem finaliza OS |
| `/empresa` | Configurações | Empresa e fiscal | Configurações da Empresa | Empresa e fiscal | Manter dados da empresa e do fiscal |
| `/configuracoes` | Configurações | Configurações gerais | Configurações | Configurações | Ajustar preferências |
| `/admin/configuracao-os` | Configurações | Checklist de OS | Configuração de OS / Checklist | Checklist de atendimento | Definir tipos de equipamento e itens de verificação |
| `/auditoria` | Configurações | Auditoria | Auditoria | Auditoria | Ver quem mudou o quê |
| `/technician/dashboard` | Início | Meu Painel (Técnico) | Meu Painel | Meu painel | Ver minha agenda e minhas OS |
| `/technician/financeiro` | (fora do menu) | Meu Financeiro (técnico) | Painel Financeiro | Meu financeiro | Ver minhas comissões e despesas |
| `/workshop/live` | Início | Oficina ao Vivo (TV) | Oficina ao Vivo | Painel de produção | Acompanhar o andamento na TV |
| `/wiki` | Ajuda | Central de Ajuda | Central de Ajuda | Central de Ajuda | Aprender a usar o sistema |
| `/suporte` | Ajuda | Suporte | Suporte | Suporte | Abrir e acompanhar chamados |
| `/notificacoes` | Ajuda | Notificações | Notificações | Notificações | Ver avisos |
| `/assinatura` | (sem menu) | — | Assinatura | Assinatura e plano | Ver e trocar o plano |
| `/mensalidade-em-atraso` | (fora do menu) | — | — | Mensalidade em atraso | Regularizar o pagamento |
| `/admin/dashboard` | Plataforma | Painel Admin Master | Painel Admin Master | Painel Admin Master | Administrar a plataforma |

## 4. Glossário de termos

Termos de uso transversal. A definição vale para **todas** as telas.

| Termo oficial | Significado | O que não é |
|---|---|---|
| **Atendimento** | Módulo opcional que reúne ordens de serviço e orçamentos | Não é o nome do perfil de leitura (ver N1) |
| **Ordem de serviço (OS)** | Registro do atendimento: cliente, solicitação, execução, valores e status | Não é orçamento nem venda |
| **Orçamento** | Proposta de valores enviada ao cliente, que pode ser convertida em OS | Não é a OS em si |
| **Venda** | Registro comercial de produtos e serviços, com ou sem documento fiscal | Não é a nota fiscal |
| **PDV** | Tela de venda rápida, para uso no balcão | Não é o histórico de vendas |
| **Recibo** | Comprovante impresso ou enviado da venda, sem documento fiscal | Não é NF-e |
| **NF-e** | Documento fiscal eletrônico de mercadoria | Não é a venda nem o recibo |
| **NFS-e** | Documento fiscal eletrônico de serviço | Não é NF-e |
| **XML** | Arquivo do documento fiscal usado para entrada de produtos | Não é o cadastro do produto |
| **Fiscal** | Módulo de emissão, acompanhamento, devolução e complemento de documentos fiscais | Não é o módulo Financeiro |
| **Estoque** | Quantidade e movimentação de produtos e peças | Não é patrimônio |
| **Patrimônio** | Ferramentas e equipamentos da empresa, com responsável | Não é estoque de revenda |
| **Meu estoque** | Itens que estão em posse do técnico | Não é o estoque da loja |
| **Demonstração** | Item cedido temporariamente para demonstração a um cliente | Não é venda nem comodato de estoque |
| **Item / Produto / Peça / Material** | "Item" é o termo genérico; "produto" é o que se vende; "peça" é o componente de reparo; "material" é o consumo interno | Não usar "produto" para peça de reparo |
| **Serviço** | Trabalho executado, cadastrado no catálogo de serviços | Não é peça |
| **Comissão** | Valor devido a quem executou a venda ou o atendimento | Não é fatura de saque |
| **Fatura de saque** | Documento que consolida valores a pagar ao técnico | Não é comissão individual |
| **Contas a receber** | Valores a receber de clientes | Não é contas a pagar |
| **Contas a pagar** | Valores a pagar a fornecedores e despesas | Não é contas a receber |
| **Cobrança** | Ação de cobrar o cliente, com ou sem registro financeiro | Não é o lançamento em si |
| **Recebimento parcial** | Entrada de parte do valor, deixando saldo em aberto | Não é pagamento total |
| **Saldo** | Valor que falta receber ou pagar | Não é o valor previsto |
| **Cliente** | Pessoa ou empresa atendida | Não é fornecedor |
| **Fornecedor** | Quem vende para a empresa | Não é transportadora |
| **Transportadora** | Quem entrega ou coleta | Não é fornecedor |
| **Pedido de compra** | Solicitação de compra, por setor | Não é despesa paga |
| **Organização / Empresa** | Conta do cliente do LivreOS, com dados fiscais e plano | Não é "tenant" na interface |
| **Perfil** | Papel do usuário: administrador, técnico ou consulta | Não é permissão individual |
| **Permissão** | Bloqueio por usuário sobre itens de menu | Não é o papel |
| **Módulo** | Bloco funcional ativável por segmento e plano | Não é uma seção de menu |
| **Plano** | Contratação que define módulos e limites | Não é o módulo |
| **Checklist** | Lista de itens de verificação de um tipo de equipamento | Não é a OS |

## 5. Termos a evitar

| Termo atual | Por que evitar | Usar em vez disso |
|---|---|---|
| Pedidos de Venda | Descreve o registro, não a tarefa | **Vendas** |
| Nova Venda (PDV) | Dois nomes na mesma expressão e um "novo" que não se sustenta no menu | **PDV** |
| Nova Venda / NF-e | Mistura venda e documento fiscal no mesmo título | **Vendas** (registrar) e **Fiscal** (emitir) |
| Notas Fiscais | Ambíguo entre "lista de notas" e "emitir nota" | **Notas emitidas** (lista) e **Emitir NF-e / NFS-e** (ação) |
| Nova NFS-e (serviço) | O parêntese explica o óbvio | **Emitir NFS-e** |
| Ordens de Serviço / Ordem de Serviço | Duas grafias na mesma tela | **Ordens de serviço** (lista) e **Ordem de serviço** (registro) |
| Meu Painel (Técnico) | O parêntese qualifica o público, não a tarefa | **Meu painel** |
| Meu Financeiro (técnico) | Idem | **Meu financeiro** |
| Meu Estoque (técnico) | Idem | **Meu estoque** |
| Oficina ao Vivo (TV) | "Oficina" fixa identidade de assistência; o parêntese qualifica o dispositivo | **Painel de produção** |
| Checklist de OS | Amarra o checklist à OS, quando ele é do equipamento | **Checklist de atendimento** |
| Configuração de OS / Checklist | Dois nomes em um título | **Checklist de atendimento** |
| Ferramentas e Equipamentos | Descrição em vez de módulo | **Patrimônio** |
| Itens para Demonstração | Genérico e sem definição de responsabilidade | **Itens em demonstração** |
| Produtos e Peças | Lista dois dos vários tipos de item | **Estoque** |
| Configurações gerais | "gerais" não distingue de Empresa e fiscal | **Configurações** |
| Gerenciamento de Equipe | Nome de ação, não de módulo | **Equipe** |
| Dashboard | Anglicismo concorrente de "Início" | **Início** |
| Rotas | Rótulo de permissão sem tela correspondente (ver N11) | Definir ou remover |
| Atendimento (como papel) | Colide com o módulo Atendimento (ver N1) | **Consulta** |
| "oficina", "drones", "equipamentos" como identidade do produto | Restringe um produto genérico e modular | Nome do segmento na própria tela ou na configuração da empresa |

## 6. Identidade de oficina/drones — ocorrências encontradas

Registradas porque o plano (seção 10) pede que o produto deixe de comunicar identidade de
drones/oficina. **Nenhuma foi alterada.**

| Local | Texto atual |
|---|---|
| `src/pages/Landing.tsx` (títulos) | "Tudo que sua oficina precisa"; "Feito para quem coloca a mão na massa"; "Pronto para profissionalizar sua oficina?" |
| `src/pages/ConfiguracaoOS.tsx` (subtítulo) | "Cadastre os tipos de equipamento que **sua oficina** atende e defina os itens de verificação (checklist de revisão) de cada um." |
| `src/pages/Estoque.tsx` (subtítulo) | "Gerencie peças, componentes e materiais" (vocabulário de oficina em um módulo de loja) |
| `src/components/layout/navConfig.ts` | "Oficina ao Vivo (TV)", "Ferramentas e Equipamentos", "Meu Estoque (técnico)" |

## 7. Conflitos de nomenclatura registrados (nenhum corrigido)

| ID | Conflito | Evidência |
|---|---|---|
| N1 | **"Atendimento" tem dois significados.** É o rótulo do papel `consulta` **e** o nome da seção de menu que o plano propõe como módulo | `src/pages/Equipe.tsx:61` (`{ value: 'consulta', label: 'Atendimento' }`) × `src/components/layout/navConfig.ts:37` (`title: "Atendimento"`) |
| N2 | Menu "Pedidos de Venda" × título "Vendas" × diálogo "Nova Venda / NF-e" × observação "Venda PDV" | `navConfig.ts` (item "Pedidos de Venda"); `src/pages/Vendas.tsx:706`, `:454`; `src/pages/PDV.tsx:189` |
| N3 | Menu "Produtos e Peças" × título "Estoque" × subtítulo "peças, componentes e materiais" | `navConfig.ts` (item "Produtos e Peças"); `src/pages/Estoque.tsx:369`, `:371` |
| N4 | "Meu Estoque (técnico)" no menu, "Meu Estoque" na tela e o mesmo componente servindo "Ferramentas e Equipamentos" | `navConfig.ts` (itens "Meu Estoque (técnico)" e "Ferramentas e Equipamentos"); `src/pages/Patrimonio.tsx:147` |
| N5 | "Meu Financeiro (técnico)" no menu, "Meu financeiro" no botão e "Painel Financeiro" no título | `navConfig.ts` (`extraPermissionItems`); `src/pages/TechnicianDashboard.tsx:156`; `src/pages/TechnicianFinancialDashboard.tsx:365` |
| N6 | "Checklist de OS" no menu × "Configuração de OS / Checklist" no título | `navConfig.ts` (item "Checklist de OS"); `src/pages/ConfiguracaoOS.tsx:178` |
| N7 | "Empresa e fiscal" no menu × "Configurações da Empresa" no título | `navConfig.ts` (item "Empresa e fiscal"); `src/pages/EmpresaConfig.tsx:188` |
| N8 | "Equipe" no menu × "Gerenciamento de Equipe" no título | `navConfig.ts` (item "Equipe"); `src/pages/Equipe.tsx:310` |
| N9 | "Configurações gerais" no menu × "Configurações" no título | `navConfig.ts` (item "Configurações gerais"); `src/pages/Configuracoes.tsx:89` |
| N10 | "Ordens de Serviço" na lista × "Ordem de Serviço" no diálogo | `src/pages/OrdensServico.tsx:1391`, `:1584` |
| N11 | "Rotas" existe como rótulo de permissão (`acesso_rotas`) sem tela, rota ou item de menu correspondente | `src/pages/Equipe.tsx:67`; `src/hooks/usePermissions.tsx:16` |
| N12 | "Notas Fiscais" aparece como tela (`/fiscal/notas`) e como aba dentro de Vendas | `navConfig.ts:68`; `src/pages/Vendas.tsx:725` |
| N13 | "NF-e de venda" é a emissão da nota de uma venda **já registrada sem nota** — o nome sugere criar a venda | `src/pages/fiscal/NfeVenda.tsx:61` (`operacao="Vendas sem nota fiscal"`) |
| N14 | "Oficina ao Vivo (TV)" no menu × "Oficina ao Vivo" no título, com identidade de oficina | `navConfig.ts:33`; `src/pages/WorkshopLive.tsx:126` |
| N15 | "Itens para Demonstração" sem definição do que é demonstração e de quem é a responsabilidade | `navConfig.ts:59`; `src/pages/Demonstracoes.tsx:150` |
| N16 | "Fatura de saque" (termo financeiro do técnico) sem definição no produto | `src/pages/TechnicianFinancialDashboard.tsx:368` |
| N17 | "Dashboard" no menu × "Visão geral" no título do computador × "Olá, {nome}!" no celular | `navConfig.ts:31`; `src/pages/Index.tsx:303`, `:281` |
| N18 | Cabeçalho do computador mostra "LivreOS" nas telas fora do menu (herdado de D14 do inventário) | `src/components/layout/openSearch.ts:10` |

## 8. Decisões de UX

1. **Renomear rótulos e títulos, nunca as URLs.** As rotas atuais permanecem: a
   `/ordens-servico?os=<id>` está impressa em etiqueta com QR code, e `/wiki/<slug>` circula
   em comunicados.
2. **Menu, título da página e cabeçalho passam a usar o mesmo nome.** É o que resolve N2 a
   N9 e N17.
3. **"Atendimento" fica com o módulo; o papel `consulta` passa a se chamar "Consulta".**
   Elimina N1 sem renomear nada de banco: é rótulo de interface.
4. **Vendas e Fiscal se separam por intenção.** Registrar venda é Vendas; emitir documento é
   Fiscal. Resolve N12 e N13.
5. **Fiscal é módulo, não etapa do fluxo comercial.** Notas emitidas, NF-e de venda,
   devoluções, complemento e NFS-e vivem dentro dele.
6. **Termos fiscais não nomeiam telas de venda nem cadastro de produto.**
7. **Parênteses de contexto saem do menu.** "(técnico)", "(TV)" e "(serviço)" são
   apresentação, não identidade.
8. **Módulos opcionais não aparecem para quem não os contratou.** Regra de descoberta:
   o item só existe no menu se o módulo estiver habilitado; hoje nenhum item depende de
   módulo ou plano (ver inventário, seção 7).
9. **Aplicação em rodadas pequenas, uma por commit.** Sugestão de ordem: (a) Vendas e Fiscal;
   (b) Estoque, Patrimônio e Demonstrações; (c) Financeiro e Relatórios; (d) Configurações e
   Equipe; (e) Início e módulos do técnico. Cada rodada ajusta `navConfig.ts` e o título da
   página correspondente, sem tocar em rota, permissão, cálculo ou fiscal.
10. **Nada é renomeado no banco.** Chaves como `acesso_rotas` e `rotas_bloqueadas` continuam
    com o nome atual nesta fase; renomear chave é tarefa própria.

## 9. Testes executados

| Item | Resultado |
|---|---|
| Comandos de build/teste | **Nenhum comando executado.** O ambiente não expõe terminal, `tsc`, Vitest ou Playwright |
| Alteração de código | **Nenhuma**, portanto não há teste de aplicação a executar |
| Verificação feita | Leitura dos arquivos listados e conferência cruzada entre `navConfig.ts`, títulos renderizados nas páginas, rótulos de papel e de permissão em `Equipe.tsx` |

Não declaro nenhuma execução de teste que não tenha ocorrido.

## 10. Validação manual

| Item | Resultado |
|---|---|
| Viewport testado | **Não aplicável** — nenhuma tela foi alterada |
| Perfis testados | **Não aplicável** nesta rodada |
| Limitação registrada | Os títulos foram conferidos por leitura de código, não por navegação no app |

## 11. Riscos e limitações

- **Decisão de produto pendente em três pontos:** (a) manter "Atendimento" como módulo e
  renomear o papel `consulta` para "Consulta"; (b) "Painel de produção" como substituto de
  "Oficina ao Vivo (TV)"; (c) "Checklist de atendimento" como substituto de "Checklist de OS".
  O glossário adota a recomendação do plano, mas essas três escolhas afetam o vocabulário de
  segmento e convém confirmá-las antes de aplicar.
- **Renomear rótulos tem custo de suporte.** Tutoriais da Central de Ajuda e materiais
  comerciais citam os nomes atuais ("Pedidos de Venda", "Oficina ao Vivo"); a aplicação em
  rodadas deve incluir a revisão do artigo correspondente.
- **N1 é o conflito mais sensível:** se "Atendimento" virar módulo sem renomear o papel, a
  mesma palavra aparece como perfil de usuário e como área do sistema.
- **N11 ("Rotas") segue sem decisão de produto:** ou ganha tela no módulo Operação de campo,
  ou sai do rótulo de permissões.
- **Nenhuma mudança de banco, RLS, cálculo, fiscal ou permissão** foi feita nesta rodada.
- **Frequência e público-alvo** seguem sem medição; o glossário é orientado à tarefa, não a
  métricas de uso.

## 12. Commit

- **Mensagem sugerida:** `docs(ui-ux): glossário de módulos e nomenclatura do LivreOS`
- **Hash:** criado automaticamente ao final desta rodada. Este ambiente não tem acesso ao
  histórico do repositório, então o hash não pode ser lido nem registrado aqui; deve ser
  obtido do `git log`.

## 13. Próximo passo recomendado

**Tarefa 3 do plano: definir o `KpiCard` oficial e mapear todos os consumidores, sem remover
o componente antigo** — `src/components/dashboard/KpiCard.tsx` e
`src/components/premium/KpiCard.tsx` hoje têm APIs e escalas de cor diferentes (P0 do plano,
seção 3). A rodada seguinte deve produzir o mapeamento dos consumidores e a decisão de API,
sem excluir nenhum dos dois componentes.

Alternativa, se a prioridade for descoberta em vez de consistência visual: aplicar o
glossário na primeira rodada de renomeação (Vendas e Fiscal), conforme a ordem da seção 8.
