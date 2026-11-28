# Relatório — inventário de rotas, menus, permissões e entradas contextuais

> Documento de **Fase 0** do *Plano de melhoria de UI/UX do LivreOS* (Tarefa 1 da seção 15).
> **Somente documentação:** nenhum código, migration, cálculo, regra de negócio ou permissão
> foi alterado por este arquivo. Todas as divergências encontradas estão **registradas** nas
> seções 7 e 8 e **não foram corrigidas** nesta rodada.

## Baseline

- **Commit analisado:** `78d1fbea69f356a712fecc91d9e14cc5d5cdd34b` (estado do repositório no
  início desta rodada; é o commit imediatamente anterior ao desta documentação).
- **Branch:** a mesma do ambiente de trabalho atual (o agente não cria branches nem faz
  checkout neste ambiente).
- **Data:** rodada executada após o plano anexado pelo solicitante.
- **Escopo declarado:** inventariar rotas, menus, permissões e entradas contextuais, sem
  alterar a aplicação.

## Objetivo

O plano de UI/UX aponta como P0 a ausência de um **mapa único entre rota, menu, permissão e
tarefa**. Antes de qualquer mudança visual, esta rodada produz a fonte única de decisão:
o inventário completo das rotas declaradas em `src/App.tsx`, do menu (`navConfig.ts`,
`Sidebar.tsx`, `BottomNav.tsx`), dos mecanismos de permissão (`ProtectedRoute`,
`usePermissions`, `PermissionTree`, `useAuth`) e de todas as **entradas contextuais** —
deep links, query strings, redirecionamentos e links internos que não passam pelo menu.

Nenhum problema encontrado aqui foi corrigido: esta é a etapa de inventário, e as
divergências ficam registradas para tarefas próprias.

## Arquivos analisados (somente leitura)

| Arquivo | Papel no mapa |
|---|---|
| `src/App.tsx` | Declaração de todas as rotas e proteções |
| `src/components/layout/navConfig.ts` | Seções, itens, papéis, `permissionItems`, `matchNavHref`, `canAccessHref`, `sectionsForRoles` |
| `src/components/layout/Sidebar.tsx` | Menu do computador |
| `src/components/layout/BottomNav.tsx` | Barra inferior do celular, ações rápidas e Sheet "Mais" |
| `src/components/layout/NavModules.tsx` | Renderização dos grupos de menu (acordeão e lista) |
| `src/components/layout/PlatformSidebar.tsx` | Menu do Admin Master (plataforma) |
| `src/components/layout/MainLayout.tsx` | Composição do layout autenticado |
| `src/components/layout/Header.tsx` | Cabeçalho do computador, busca global, menu de conta |
| `src/components/layout/MobileHeader.tsx` | Cabeçalho do celular |
| `src/components/layout/openSearch.ts` | `pageTitleFor` e disparo da busca global |
| `src/components/ProtectedRoute.tsx` | Verificação real de acesso por rota |
| `src/hooks/usePermissions.tsx` | `rotas_bloqueadas` e chaves de acesso por usuário |
| `src/hooks/useAuth.tsx` | Papéis (`admin`, `tecnico`, `consulta`) |
| `src/hooks/useOrganization.tsx` | Organização, plano e `status` (bloqueio por mensalidade) |
| `src/hooks/useFeatureAccess.tsx` | Recursos por plano |
| `src/hooks/useUsageLimits.tsx` | Limites de OS e usuários por plano |
| `src/components/team/PermissionTree.tsx` | Árvore de bloqueio por usuário (Equipe) |
| `src/components/GlobalSearch.tsx` | Busca global (Ctrl+K) |
| `src/components/UpgradePlanModal.tsx` / `src/components/PayButton.tsx` | Portas de entrada para `/assinatura` |
| `src/pages/*` (46 arquivos) | Confirmação de que toda página tem rota |

## O que foi feito

1. Levantamento das **52 rotas** declaradas em `src/App.tsx`, com componente, proteção e
   classificação de uso (navegação, contextual, administrativa, legada, pública).
2. Levantamento do menu: **35 itens** em 8 seções no `navConfig.ts` + 1 item em
   `extraPermissionItems` = **36 hrefs** em `permissionItems`.
3. Mapa de como o acesso é realmente decidido (papel, `rotas_bloqueadas`, `status` da
   organização, plano e limites), separando o que **é** controle de acesso do que **parece**
   ser.
4. Levantamento das **entradas contextuais**: deep links por query string, redirecionamentos,
   links internos que não passam pelo menu e atalhos.
5. Registro de **15 divergências** entre rota, menu, papel e permissão (seção 8), sem corrigir
   nenhuma.
6. Levantamento das telas sem caminho de descoberta no menu (seção 6).

## 1. Contagem e visão geral

| Grupo | Quantidade |
|---|---|
| Rotas declaradas em `App.tsx` | 52 (inclui 3 redirecionamentos e o `*` de 404) |
| Rotas com componente de página | 49 (48 telas + o `*` de 404) |
| Públicas (sem autenticação) | 7 (`/`, `/auth`, `/admin/login`, `/reset-password`, `/cadastro-empresa`, `/landing`, `*`) |
| Itens de menu (`navSections`) | 35, em 8 seções |
| Itens fora do menu mas com permissão (`extraPermissionItems`) | 1 (`/technician/financeiro`) |
| Total em `permissionItems` | 36 |
| Itens de menu sem rota correspondente | 0 |
| Páginas em `src/pages` sem rota | 0 |

## 2. Inventário de rotas

Legenda de **classificação**: `pública` · `navegação` (tem item de menu) ·
`contextual` (não tem item de menu, alcançada por ação/estado) · `legada` (redirecionamento
de compatibilidade) · `interna` (estado de um fluxo dentro de uma tela de navegação).

Legenda de **proteção efetiva**: o que o `ProtectedRoute` realmente aplica hoje.
`autenticado` = apenas sessão válida; `papel:<x>` = `requiredRole`; `bloqueio:sim` = rota
casada por `matchNavHref` e sujeita a `rotas_bloqueadas`; `bloqueio:não` = não casada
(nenhum bloqueio por usuário é aplicado); `allowBlocked` = org bloqueada por mensalidade
ainda acessa; `platformAdmin` = exige `platform_admins`.

### 2.1 Públicas

| Rota | Componente (arquivo) | Proteção efetiva | Observações |
|---|---|---|---|
| `/` | `Auth` | pública | Redireciona para `/admin/login` se `window.location.pathname` começar com `/admin` (ver D12) |
| `/auth` | `Auth` | pública | Página de login da empresa; trata `?` de sessão no `Auth.tsx` |
| `/admin/login` | `AdminAuth` | pública | Login do Admin Master |
| `/reset-password` | `ResetPassword` | pública | Também é destino de `resetPasswordForEmail` |
| `/cadastro-empresa` | `CadastroEmpresa` | pública | Cadastro de nova empresa (sem `ProtectedRoute`) |
| `/landing` | `Landing` | pública | Página comercial |
| `*` | `NotFound` | pública | 404 |

### 2.2 Navegação (têm item de menu)

| Rota | Arquivo | Proteção efetiva | Item de menu | Seção | Papéis do menu |
|---|---|---|---|---|---|
| `/dashboard` | `Index.tsx` | autenticado; `bloqueio:sim`, mas isento por código (D6) | Dashboard | Início | admin, tecnico, consulta |
| `/technician/dashboard` | `TechnicianDashboard.tsx` | autenticado; `bloqueio:sim` | Meu Painel (Técnico) | Início | admin, tecnico |
| `/workshop/live` | `WorkshopLive.tsx` | autenticado; `bloqueio:sim` | Oficina ao Vivo (TV) | Início | todos |
| `/ordens-servico` | `OrdensServico.tsx` | autenticado; `bloqueio:sim` | Ordens de Serviço | Atendimento | todos |
| `/orcamentos` | `Orcamentos.tsx` | autenticado; `bloqueio:sim` | Orçamentos | Atendimento | admin, tecnico |
| `/clientes` | `Clientes.tsx` | autenticado; `bloqueio:sim` | Clientes | Cadastros | todos |
| `/fornecedores` | `Fornecedores.tsx` | autenticado; `bloqueio:sim` | Fornecedores | Cadastros | todos |
| `/transportadoras` | `Transportadoras.tsx` | autenticado; `bloqueio:sim` | Transportadoras | Cadastros | todos |
| `/servicos` | `Servicos.tsx` | autenticado; `bloqueio:sim` | Serviços | Cadastros | todos |
| `/estoque` | `Estoque.tsx` | autenticado; `bloqueio:sim` | Produtos e Peças | Estoque | todos |
| `/meu-estoque` | `Patrimonio.tsx` (prop `meu`) | autenticado; `bloqueio:sim` | Meu Estoque (técnico) | Estoque | admin, tecnico |
| `/estoque/importar-xml` | `ImportarXmlNfe.tsx` | autenticado; `bloqueio:sim` | Importar XML (NF-e) | Estoque | admin, tecnico |
| `/compras` | `PedidosCompra.tsx` | autenticado; `bloqueio:sim` | Pedidos de Compra | Estoque | admin, tecnico |
| `/demonstracoes` | `Demonstracoes.tsx` | autenticado; `bloqueio:sim` | Itens para Demonstração | Estoque | admin, tecnico |
| `/patrimonio` | `Patrimonio.tsx` | papel:admin; `bloqueio:sim` | Ferramentas e Equipamentos | Estoque | admin |
| `/pdv` | `PDV.tsx` | autenticado; `bloqueio:sim` | Nova Venda (PDV) | Vendas e Notas | admin, tecnico |
| `/vendas` | `Vendas.tsx` | autenticado; `bloqueio:sim` | Pedidos de Venda | Vendas e Notas | admin, tecnico |
| `/fiscal/notas` | `fiscal/NotasFiscais.tsx` | autenticado; `bloqueio:sim` | Notas Fiscais | Vendas e Notas | admin, tecnico |
| `/fiscal/nfe/venda` | `fiscal/NfeVenda.tsx` | autenticado; `bloqueio:sim` | NF-e de venda | Vendas e Notas | admin, tecnico |
| `/fiscal/nfe/devolucao-venda` | `fiscal/DevolucaoVenda.tsx` | autenticado; `bloqueio:sim` | Devolução de venda | Vendas e Notas | admin (ver D3) |
| `/fiscal/nfe/devolucao-compra` | `fiscal/DevolucaoCompra.tsx` | autenticado; `bloqueio:sim` | Devolução de compra | Vendas e Notas | admin (ver D3) |
| `/fiscal/nfse` | `NovaNfse.tsx` | autenticado; `bloqueio:sim` | Nova NFS-e (serviço) | Vendas e Notas | admin, tecnico |
| `/financeiro` | `Financeiro.tsx` | autenticado; `bloqueio:sim` | Financeiro | Financeiro | admin, tecnico |
| `/contas-pagar` | `ContasPagar.tsx` | autenticado; `bloqueio:sim` | Contas a Pagar | Financeiro | admin, tecnico |
| `/comissoes` | `Comissoes.tsx` | papel:admin; `bloqueio:sim` | Comissões | Financeiro | admin |
| `/cobrancas` | `Cobrancas.tsx` | autenticado; `bloqueio:sim` | Cobranças | Financeiro | admin, tecnico |
| `/relatorios` | `Relatorios.tsx` | autenticado; `bloqueio:sim` | Relatórios | Financeiro | todos |
| `/equipe` | `Equipe.tsx` | papel:admin; `bloqueio:sim` | Equipe | Configurações | admin |
| `/empresa` | `EmpresaConfig.tsx` | papel:admin; `bloqueio:sim` | Empresa e fiscal | Configurações | admin |
| `/configuracoes` | `Configuracoes.tsx` | papel:admin; `bloqueio:sim` | Configurações gerais | Configurações | admin |
| `/admin/configuracao-os` | `ConfiguracaoOS.tsx` | papel:admin; `bloqueio:sim` | Checklist de OS | Configurações | admin |
| `/auditoria` | `Auditoria.tsx` | papel:admin; `bloqueio:sim` | Auditoria | Configurações | admin |
| `/wiki` | `Wiki.tsx` | autenticado; `bloqueio:sim` | Central de Ajuda | Ajuda | todos |
| `/suporte` | `Suporte.tsx` | autenticado; `bloqueio:sim` | Suporte | Ajuda | todos |
| `/notificacoes` | `Notificacoes.tsx` | autenticado; `bloqueio:sim` | Notificações | Ajuda | todos |

### 2.3 Contextuais (sem item de menu)

| Rota | Arquivo | Proteção efetiva | Como o usuário chega hoje | Observações |
|---|---|---|---|---|
| `/permissoes` | `Permissoes.tsx` | papel:admin; `bloqueio:não` | Link "Permissões de OS" dentro de `/configuracoes` | Fora de `permissionItems`; título no cabeçalho cai em "LivreOS" (D14) |
| `/assinatura` | `Assinatura.tsx` | papel:admin + `allowBlocked`; `bloqueio:não` | Botão do `UpgradePlanModal` | Fora de `permissionItems`; não aparece na árvore de permissões |
| `/fiscal/nfe/complementar` | `fiscal/NfeComplementar.tsx` | autenticado; `bloqueio:não` | **Nenhum caminho de descoberta no app** (D7) | Fora de `navConfig.ts` e de `extraPermissionItems` |
| `/technician/financeiro` | `TechnicianFinancialDashboard.tsx` | papel:tecnico; `bloqueio:sim` | Link "Meu Financeiro" dentro de `/technician/dashboard` | Único item de `extraPermissionItems` |
| `/wiki/:slug` | `Wiki.tsx` | autenticado; `bloqueio:não` | Link do artigo na própria Central de Ajuda; link de comunicados (`/wiki/algum-artigo`) | Não casada por `matchNavHref` (D5) |
| `/mensalidade-em-atraso` | `MensalidadeAtraso.tsx` | `allowBlocked`; `bloqueio:não` | Redirecionamento automático do `ProtectedRoute` | Não aparece no menu, por decisão de produto |
| `/admin/dashboard` | `AdminMaster.tsx` | `platformAdmin`; `bloqueio:não` | Link "Painel Admin Master" no rodapé da Sidebar (só para platform admin) e login do `AdminAuth` | Tem menu próprio (`PlatformSidebar.tsx`) com 8 abas por query string |

### 2.4 Internas de fluxo (estado dentro de uma tela)

| Entrada | Tela | Efeito |
|---|---|---|
| `/ordens-servico?os=<id>` | `OrdensServico.tsx` | Abre a OS indicada e limpa o parâmetro da URL |
| `/vendas?nova=1` | `Vendas.tsx` | Abre o formulário de nova venda |
| `/vendas?nfe=1` | `Vendas.tsx` | Abre o formulário com emissão de NF-e |
| `/vendas?tab=notas` | `Vendas.tsx` | Abre a aba "Notas" |
| `/admin/dashboard?tab=<aba>` | `AdminMaster.tsx` | Seleciona a aba (`overview`, `tenants`, `plans`, `support`, `broadcast`, `wiki`, `site`, `config`) |
| `?pwa=1` (qualquer rota) | `App.tsx` | Marca a sessão como PWA (modo aplicativo) |

### 2.5 Legadas e redirecionamentos

| Rota | Destino | Motivo |
|---|---|---|
| `/produtos` | `/estoque` | Rota antiga de produtos |
| `/admin` | `/admin/login` | Atalho para o login do Admin Master |
| `/admin/retencoes` | `/dashboard` | Tela de retenções descontinuada |

## 3. Inventário do menu

### 3.1 Seções e itens (`navConfig.ts`)

| Seção | Itens (nome exibido) | Papéis permitidos na seção |
|---|---|---|
| Início | Dashboard; Meu Painel (Técnico); Oficina ao Vivo (TV) | todos; admin+tecnico; todos |
| Atendimento | Ordens de Serviço; Orçamentos | todos; admin+tecnico |
| Cadastros | Clientes; Fornecedores; Transportadoras; Serviços | todos |
| Estoque | Produtos e Peças; Meu Estoque (técnico); Importar XML (NF-e); Pedidos de Compra; Itens para Demonstração; Ferramentas e Equipamentos | todos; admin+tecnico (4); admin (1) |
| Vendas e Notas | Nova Venda (PDV); Pedidos de Venda; Notas Fiscais; NF-e de venda; Devolução de venda; Devolução de compra; Nova NFS-e (serviço) | admin+tecnico; admin (2) |
| Financeiro | Financeiro; Contas a Pagar; Comissões; Cobranças; Relatórios | admin+tecnico; admin (1); todos (1) |
| Configurações | Equipe; Empresa e fiscal; Configurações gerais; Checklist de OS; Auditoria | admin |
| Ajuda | Central de Ajuda; Suporte; Notificações | todos |
| Fora do menu (`extraPermissionItems`) | Meu Financeiro (técnico) | tecnico |

### 3.2 Computador

- `Sidebar.tsx` renderiza `NavModules` em modo **acordeão** (`dark`, sem `flat`): o grupo
  fica fechado até ser clicado ou conter a rota ativa.
- O rodapé mostra "Painel Admin Master" somente quando o usuário está em
  `platform_admins`.
- `Header.tsx` mostra a trilha "Início + título da página" usando `pageTitleFor`, que consulta
  `permissionItems` (telas fora do menu exibem "LivreOS" — D14), além de busca global,
  notificações, tema, empresa e menu de conta ("Meu perfil" → `/configuracoes`, "Empresa" →
  `/empresa` só para admin).
- `FlatModule` (itens sempre visíveis) existe em `NavModules.tsx` mas **nunca é usado** —
  a prop `flat` não é passada por nenhum consumidor (D11).

### 3.3 Celular

- `MobileHeader.tsx`: logo, sino de notificações e menu de conta ("Meu perfil" e "Sair").
- `BottomNav.tsx` tem **5 pontos**: Início (`/dashboard`), Operação (`/ordens-servico` e
  `/orcamentos`), Adicionar (botão central, abre a Sheet de ações rápidas), Relatórios
  (`/relatorios`) e Mais (abre a Sheet "Módulos" com o menu completo).
- Ações rápidas (Sheet "Adicionar"), filtradas por papel e por `rotas_bloqueadas`:

| Rótulo | Destino | Papéis |
|---|---|---|
| Nova OS | `/ordens-servico` | todos |
| Nova venda | `/pdv` | admin, tecnico |
| Orçamento | `/orcamentos` | admin, tecnico |
| Cliente | `/clientes` | todos |
| Estoque | `/estoque` | todos |

### 3.4 Admin Master (plataforma)

`PlatformSidebar.tsx` tem menu próprio, independente de `navConfig.ts`: Visão Geral,
Clientes (Tenants), Planos & Preços, Suporte Global, Comunicados, Wiki do Sistema,
Gestão do Site e Configurações Asaas — todas apontando para `/admin/dashboard?tab=...`.

## 4. Como o acesso é realmente decidido

Ordem de verificação no `ProtectedRoute.tsx`:

1. **Carregando** (`useAuth` + `usePermissions` + `useOrganization`) → tela de carregamento.
2. **Sem sessão** → redireciona para `/auth`.
3. **`requiredPlatformAdmin`** e não é platform admin → `/dashboard`.
4. **Organização com `status = 'blocked'`** (e sem `allowBlocked`, e não platform admin) →
   `/mensalidade-em-atraso`.
5. **Bloqueio por usuário:** `matchNavHref(pathname, search)` procura o href em
   `permissionItems` (exato com query, depois só o caminho). Se encontrar e o href não for
   `/dashboard`, aplica `canAccessHref` (admins passam sempre; os demais são bloqueados se o
   href estiver em `rotas_bloqueadas`) → `toast.error('Sem acesso a esta tela')` e
   `/dashboard`.
6. **`requiredRole`** com hierarquia `admin(3) > tecnico(2) > consulta(1)` → tela
   "Acesso Restrito" (não redireciona).

Camadas que **não** participam da navegação:

- **`requiredPermission` está deprecado e é ignorado.** O `ProtectedRoute` recebe
  `acesso_os`, `acesso_estoque` e `acesso_financeiro` em 13 rotas, mas a prop não é lida.
  O comentário no próprio componente diz que o controle é exclusivo de `rotas_bloqueadas`
  (D1).
- **Recursos por plano (`useFeatureAccess`)** não bloqueiam nenhuma rota nem item de menu.
  As 10 chaves (`os`, `clientes`, `estoque`, `orcamentos`, `financeiro`, `cobrancas_asaas`,
  `whatsapp_templates`, `whitelabel`, `api_rest`, `suporte_prioritario`) são consumidas
  apenas por `PayButton` (`cobrancas_asaas`).
- **Limites por plano (`useUsageLimits`)** agem em **ações**, não em rotas: `canCreateOS`
  (criação de OS) e `canInviteUser` (convite na Equipe), ambos abrindo o
  `UpgradePlanModal`.
- **Chaves de `user_permissions`** (`acesso_os`, `acesso_estoque`, `acesso_financeiro`,
  `acesso_dashboard`, ...) são lidas e devolvidas pelo hook, mas o único campo usado pela
  navegação é `rotas_bloqueadas`. A árvore de bloqueio em `PermissionTree.tsx` é montada a
  partir de `permissionItems`, não das chaves booleanas.

Conclusão do mapa: hoje o acesso é decidido por **papel (`user_roles`)** +
**`rotas_bloqueadas` (por usuário)** + **`status` da organização** + **limites de uso por
plano**. Não existe hoje nenhuma navegação orientada a **módulo habilitado**.

## 5. Entradas contextuais fora do menu

| Tipo | Origem | Destino | Arquivo |
|---|---|---|---|
| Deep link de OS | QR code da etiqueta 58 mm | `/ordens-servico?os=<id>` | `components/ordens-servico/EtiquetaOS58.tsx` |
| Deep link de artigo | Comunicados e Central de Ajuda | `/wiki/<slug>` | `components/admin/BroadcastTab.tsx`, `pages/Wiki.tsx` |
| Aba de notas | Fim da emissão de NFS-e | `/vendas?tab=notas` | `pages/NovaNfse.tsx` |
| Aba/estado de venda | Links internos | `/vendas?nova=1`, `/vendas?nfe=1` | `pages/Vendas.tsx` (leitura) |
| Ações do painel | Cards do Dashboard | `/ordens-servico`, `/pdv`, `/financeiro`, `/compras`, `/vendas` | `pages/Index.tsx` |
| Ação do PDV | Botão "Voltar" | `/dashboard` | `pages/PDV.tsx` |
| Ação do técnico | Botão no painel | `/technician/financeiro` | `pages/TechnicianDashboard.tsx` |
| Configuração fiscal | Aviso na NFS-e | `/empresa`, `/clientes` | `pages/NovaNfse.tsx` |
| Administrativas | Configurações | `/equipe`, `/permissoes` | `pages/Configuracoes.tsx` |
| Upgrade | Modal de plano e PayButton | `/assinatura` | `components/UpgradePlanModal.tsx`, `components/PayButton.tsx` |
| Busca global | Ctrl+K (overlay) | `/ordens-servico`, `/clientes`, `/estoque` | `components/GlobalSearch.tsx` |
| Notificações | Sino | `/notificacoes` | `components/NotificationBell.tsx` |
| PWA | `?pwa=1` na URL | marca a sessão como app instalado | `App.tsx` |
| Bloqueio de mensalidade | `ProtectedRoute` | `/mensalidade-em-atraso` | `components/ProtectedRoute.tsx` |
| Site comercial | Landing | `/auth`, `/cadastro-empresa` | `pages/Landing.tsx` |

## 6. Telas sem caminho de descoberta no menu

| Tela | Situação | Recomendação de tratamento (não executada) |
|---|---|---|
| `/fiscal/nfe/complementar` | Sem menu, sem entrada contextual e fora da árvore de permissões | Definir entrada a partir de Notas Fiscais e incluí-la em `permissionItems` |
| `/permissoes` | Só pelo link dentro de Configurações | Manter como página interna de Configurações e entrar em `permissionItems` |
| `/assinatura` | Só pelo modal de upgrade | Manter como página contextual e entrar em `permissionItems` |
| `/wiki/:slug` | Deep link de artigo | Tratar como subpágina de `/wiki` no casamento de permissão |
| `/mensalidade-em-atraso` | Só por redirecionamento | Manter fora do menu (estado de bloqueio) |
| `/admin/dashboard` | Só para platform admin | Manter no menu próprio da plataforma |

## 7. Matriz de informação (base para revisar `navConfig.ts`)

Colunas pedidas pelo plano, já preenchidas com o que existe hoje. `Frequência` e
`Público-alvo` são **propostas a validar** com o solicitante, não dados medidos.

| Módulo (proposto) | Tarefa principal | Rota | Nome exibido hoje | Entrada pelo menu | Entrada contextual | Papel mínimo hoje | Bloqueio por usuário | Depende de módulo/plano |
|---|---|---|---|---|---|---|---|---|
| Início | Ver resultado e pendências | `/dashboard` | Dashboard | sim | ações do painel | todos | sim (isento) | não |
| Atendimento | Gerenciar OS | `/ordens-servico` | Ordens de Serviço | sim | `?os=<id>` (etiqueta), busca global, dashboard | todos | sim | não |
| Atendimento | Orçamentos | `/orcamentos` | Orçamentos | sim | barra inferior "Operação" | admin/tecnico | sim | não |
| Operação de campo | Painel do técnico | `/technician/dashboard` | Meu Painel (Técnico) | sim | — | admin/tecnico | sim | não |
| Operação de campo | Financeiro do técnico | `/technician/financeiro` | Meu Financeiro (técnico) | não | botão no painel do técnico | tecnico | sim | não |
| Operação de campo | Painel de oficina (TV) | `/workshop/live` | Oficina ao Vivo (TV) | sim | — | todos | sim | não |
| Cadastros | Clientes | `/clientes` | Clientes | sim | ação rápida, NFS-e, busca global | todos | sim | não |
| Cadastros | Fornecedores | `/fornecedores` | Fornecedores | sim | — | todos | sim | não |
| Cadastros | Transportadoras | `/transportadoras` | Transportadoras | sim | — | todos | sim | não |
| Cadastros | Serviços | `/servicos` | Serviços | sim | — | todos | sim | não |
| Estoque | Inventário | `/estoque` | Produtos e Peças | sim | ação rápida, busca global, dashboard | todos | sim | não |
| Estoque | Estoque do técnico | `/meu-estoque` | Meu Estoque (técnico) | sim | — | admin/tecnico | sim | não |
| Estoque | Importar XML | `/estoque/importar-xml` | Importar XML (NF-e) | sim | botão "Estoque" na tela | admin/tecnico | sim | não |
| Compras | Pedidos de compra | `/compras` | Pedidos de Compra | sim | alerta no dashboard | admin/tecnico | sim | não |
| Estoque | Demonstrações | `/demonstracoes` | Itens para Demonstração | sim | — | admin/tecnico | sim | não |
| Patrimônio | Ferramentas e equipamentos | `/patrimonio` | Ferramentas e Equipamentos | sim | — | admin | sim | não |
| Vendas | Venda rápida | `/pdv` | Nova Venda (PDV) | sim | ação rápida, dashboard | admin/tecnico | sim | não |
| Vendas | Histórico de vendas | `/vendas` | Pedidos de Venda | sim | `?nova=1`, `?nfe=1`, `?tab=notas`, dashboard | admin/tecnico | sim | não |
| Fiscal | Notas emitidas | `/fiscal/notas` | Notas Fiscais | sim | `/vendas?tab=notas` | admin/tecnico | sim | não |
| Fiscal | NF-e de venda | `/fiscal/nfe/venda` | NF-e de venda | sim | — | admin/tecnico | sim | não |
| Fiscal | Devolução de venda | `/fiscal/nfe/devolucao-venda` | Devolução de venda | sim | — | admin (menu) | sim | não |
| Fiscal | Devolução de compra | `/fiscal/nfe/devolucao-compra` | Devolução de compra | sim | — | admin (menu) | sim | não |
| Fiscal | NF-e complementar | `/fiscal/nfe/complementar` | — | **não** | **nenhuma** | todos | não | não |
| Fiscal | NFS-e de serviço | `/fiscal/nfse` | Nova NFS-e (serviço) | sim | — | admin/tecnico | sim | não |
| Financeiro | Visão geral | `/financeiro` | Financeiro | sim | dashboard | admin/tecnico | sim | não |
| Financeiro | Contas a pagar | `/contas-pagar` | Contas a Pagar | sim | — | admin/tecnico | sim | não |
| Financeiro | Comissões | `/comissoes` | Comissões | sim | — | admin | sim | não |
| Financeiro | Cobranças | `/cobrancas` | Cobranças | sim | — | admin/tecnico | sim | não |
| Relatórios | Relatórios | `/relatorios` | Relatórios | sim | barra inferior | todos | sim | não |
| Configurações | Equipe | `/equipe` | Equipe | sim | link em Configurações | admin | sim | não |
| Configurações | Permissões de OS | `/permissoes` | — | **não** | link em Configurações | admin | não | não |
| Configurações | Empresa e fiscal | `/empresa` | Empresa e fiscal | sim | aviso na NFS-e | admin | sim | não |
| Configurações | Configurações gerais | `/configuracoes` | Configurações gerais | sim | menu de conta | admin | sim | não |
| Configurações | Checklist de OS | `/admin/configuracao-os` | Checklist de OS | sim | — | admin | sim | não |
| Configurações | Auditoria | `/auditoria` | Auditoria | sim | — | admin | sim | não |
| Assinatura | Plano e cobrança | `/assinatura` | — | **não** | modal de upgrade | admin | não | sim (plano) |
| Ajuda | Central de Ajuda | `/wiki` | Central de Ajuda | sim | comunicados | todos | sim | não |
| Ajuda | Suporte | `/suporte` | Suporte | sim | — | todos | sim | não |
| Ajuda | Notificações | `/notificacoes` | Notificações | sim | sino do cabeçalho | todos | sim | não |
| Plataforma | Admin Master | `/admin/dashboard` | Painel Admin Master | menu próprio | link na Sidebar | platform admin | não | não |

Observação de produto para a próxima etapa: **nenhum item depende hoje de módulo ou plano**.
A coluna "Depende de módulo/plano" está "não" em quase toda a matriz, o que confirma o
diagnóstico do plano (seção 10): a modularidade comercial existe no conceito, mas ainda não
na descoberta.

## 8. Divergências registradas (nenhuma corrigida)

| ID | Divergência | Evidência | Impacto |
|---|---|---|---|
| D1 | `requiredPermission` é ignorado em 13 rotas | `ProtectedRoute.tsx` não lê a prop | Leitura enganosa do código: parece haver controle por permissão que não existe |
| D2 | 7 rotas sem item de menu | `/permissoes`, `/assinatura`, `/fiscal/nfe/complementar`, `/technician/financeiro`, `/wiki/:slug`, `/mensalidade-em-atraso`, `/admin/dashboard` | Caminhos percebidos como escondidos |
| D3 | "Devolução de venda/compra" são admin no menu, mas a rota não exige papel | `navConfig.ts` (`ADMIN`) × `App.tsx` (sem `requiredRole`) | Técnico e consulta alcançam pela URL o que o menu não mostra |
| D4 | 14 itens são admin/tecnico no menu, mas as rotas aceitam qualquer autenticado | `/pdv`, `/vendas`, `/compras`, `/meu-estoque`, `/demonstracoes`, `/fiscal/notas`, `/fiscal/nfe/venda`, `/fiscal/nfse`, `/financeiro`, `/contas-pagar`, `/cobrancas`, `/orcamentos`, `/estoque/importar-xml`, `/technician/dashboard` | Perfil `consulta` entra por URL em telas operacionais |
| D5 | `/wiki/:slug` não é casado por `matchNavHref` | `matchNavHref` compara o caminho exato | Bloquear "Central de Ajuda" não bloqueia o artigo |
| D6 | `/dashboard` é isento do bloqueio | `navHref !== '/dashboard'` em `ProtectedRoute.tsx` | Bloquear Dashboard só o remove do menu |
| D7 | `/fiscal/nfe/complementar` está fora de `navConfig.ts` e de `extraPermissionItems` | Ausência nos dois arrays | Não aparece na árvore de permissões e não pode ser bloqueada |
| D8 | "Relatórios" está na seção "Financeiro" | `navConfig.ts` | Relatórios é transversal, não financeiro |
| D9 | Ações rápidas do celular prometem criação e entregam a listagem | `BottomNav.tsx` (`/ordens-servico`, `/pdv`, `/orcamentos`) | Usuário precisa dar um segundo passo para criar |
| D10 | "Operação" na barra inferior só cobre OS e Orçamentos | `BottomNav.tsx` | Painel e financeiro do técnico caem em "Mais" |
| D11 | `FlatModule` é código morto | `flat` nunca é passado para `NavModules` | O comentário descreve um menu do computador que não é o renderizado |
| D12 | Verificação `/admin` redundante na rota `/` | `App.tsx` | Código sem efeito (já existe `/admin` e o `*`) |
| D13 | Nomenclatura ambígua entre venda, PDV, notas e fiscal | "Pedidos de Venda", "Nova Venda (PDV)", "Notas Fiscais", "NF-e de venda", "Nova NFS-e (serviço)" | Precisa do glossário da Tarefa 2 do plano |
| D14 | `pageTitleFor` mostra "LivreOS" nas telas fora do menu | `openSearch.ts` usa `permissionItems` | Cabeçalho sem contexto em `/permissoes`, `/assinatura`, `/fiscal/nfe/complementar`, `/wiki/:slug`, `/mensalidade-em-atraso` |
| D15 | A busca global ignora o deep link de OS existente | `GlobalSearch.tsx` navega para `/ordens-servico` | Encontra a OS e não abre a OS |

## 9. Decisões de UX tomadas nesta rodada

Nenhuma decisão visual foi aplicada. As decisões desta rodada são de **escopo**:

1. **Não alterar a aplicação** — nenhuma rota, item de menu, permissão ou estilo foi
   modificado; o documento é a entrega.
2. **Classificar antes de redesenhar** — as rotas foram separadas em pública, navegação,
   contextual, interna de fluxo e legada, para que a futura revisão do menu não precise
   decidir isso de improviso.
3. **Registrar, não corrigir** — as 15 divergências ficam documentadas com evidência e
   impacto, para virar tarefa própria.
4. **Documentar a proteção real, não a aparente** — o inventário explicita que
   `requiredPermission` não é aplicado e que a decisão de acesso é
   papel + `rotas_bloqueadas` + `status` da organização + limites de plano.
5. **Separar menu de computador e de celular como dois pontos do mesmo mapa mental** — a
   barra inferior foi inventariada como atalho, não como arquitetura paralela.

## 10. Testes executados

| Item | Resultado |
|---|---|
| Comandos de build/teste | **Nenhum comando executado.** O ambiente desta rodada não expõe terminal, `tsc`, Vitest ou Playwright — apenas leitura e escrita de arquivos e SQL |
| Alteração de código | **Nenhuma**, portanto não há teste de aplicação a executar |
| Verificação feita | Leitura integral dos arquivos listados na seção "Arquivos analisados" e conferência cruzada entre `App.tsx` × `navConfig.ts` × `ProtectedRoute.tsx` × `PermissionTree.tsx` |

Não declaro nenhuma execução de teste que não tenha ocorrido.

## 11. Validação manual

| Item | Resultado |
|---|---|
| Viewport testado | **Não aplicável** — nenhuma tela foi alterada |
| Perfis testados | **Não aplicável** nesta rodada |
| Limitação registrada | A conferência dos 36 hrefs de `permissionItems` contra as 52 rotas foi feita por leitura de código; não houve navegação em navegador |

## 12. Riscos e limitações

- **Documento derivado de leitura estática.** Não houve execução do app; se alguma rota for
  adicionada por outro caminho (por exemplo, navegação por código fora do `App.tsx`), o
  inventário precisa ser reconferido.
- **O ambiente não cria branch.** As regras do plano pedem trabalho em branch e commits
  separados por melhoria; aqui o commit é criado automaticamente ao final da rodada, na
  branch atual. Isso está fora do controle do agente e precisa ser tratado no fluxo de
  trabalho.
- **Frequência e público da matriz (seção 7) são propostas**, não medições. Dependem de
  validação com o solicitante e, mais adiante, de métricas de uso.
- **As divergências D1 a D15 seguem abertas** por decisão de escopo. Duas delas (D3 e D4)
  envolvem diferença entre o que o menu mostra e o que a rota permite e podem ser lidas como
  falha de segurança de informação — devem ser priorizadas antes de qualquer redesenho de
  menu.
- **Nenhuma mudança de banco, RLS, cálculo, fiscal ou permissão** foi feita nesta rodada.

## 13. Commit

- **Mensagem sugerida:** `docs(ui-ux): inventário de rotas, menu, permissões e entradas contextuais`
- **Hash:** criado automaticamente ao final desta rodada. Este ambiente não tem acesso ao
  histórico do repositório, então o hash não pode ser lido nem registrado aqui; deve ser
  obtido do `git log`.

## 14. Próximo passo recomendado

**Tarefa 2 do plano: definir e documentar o glossário de módulos e nomenclatura do LivreOS**
(`Vendas`, `PDV`, `Fiscal`, `Atendimento`, `Operação de campo`, `Assistência técnica`,
`Estoque`, `Financeiro`, `Cadastros`, `Configurações`, `Ajuda`), resolvendo D13, e em seguida
decidir o destino das divergências D3, D4, D5, D6 e D7 em tarefa própria de permissões —
antes de mexer no menu.

É uma tarefa pequena, independente e verificável, e não altera código de aplicação.
