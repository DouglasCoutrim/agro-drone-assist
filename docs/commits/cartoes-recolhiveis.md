# Cartões e blocos recolhíveis (acordeão)

Todo cartão no padrão do sistema agora pode ser encolhido, e cada bloco dos painéis
personalizáveis ganhou o mesmo recurso. Nada de dado de negócio muda: é só apresentação.

## `PremiumCard` (`src/components/premium/PremiumCard.tsx`)

Novas props (todas opcionais):

| Prop | Padrão | Para que serve |
| --- | --- | --- |
| `recolhivel` | `true` | Mostra o botão "Encolher/Expandir" no topo do cartão |
| `recolhidoInicial` | `false` | Começa encolhido |
| `rotulo` | — | Nome do cartão, mostrado à esquerda do botão |

- O conteúdo fica num `div` com `hidden` quando encolhido (o conteúdo continua montado,
  então nada é recarregado nem perde estado ao expandir de novo).
- Acessibilidade: o botão tem `aria-expanded` e `aria-controls`.

## Blocos do painel (`src/components/layout/PainelOrdenavel.tsx`)

- Cada bloco agora tem, ao lado do puxador, o botão "Encolher/Expandir" que fecha o bloco
  inteiro — vale para **todas** as telas que já usam o painel personalizável.
- Regra de convivência: **dentro de um bloco de painel, quem encolhe é o bloco**. O
  `PremiumCard` detecta isso por contexto (`src/components/layout/painel-bloco-context.ts`)
  e não mostra um segundo botão para o mesmo conteúdo.
- O bloco encolhido continua arrastável e as setas ↑ ↓ continuam funcionando.

## Destaque de quem está encolhido

Para o bloco/cartão encolhido não "sumir" da tela, o rótulo dele fica **verde e maior** enquanto
está fechado; ao expandir volta ao estilo discreto. O botão "Expandir" ganha contorno verde no
estado encolhido e o rótulo longo trunca em vez de quebrar o cabeçalho.

Cores: usa a mesma pintura do botão **"Nova Transação"** (`gradient-primary`, ou seja
`linear-gradient(135deg, hsl(var(--primary)), hsl(142 72% 44%))` com `text-primary-foreground`),
com `text-sm font-semibold`, `px-3 py-1` e ícone maior — nada de cor nova fora do tema.

O `PremiumCard` mostra o nome do cartão no selo verde: use a prop `rotulo` (ex.: `rotulo="Fechamento do dia"`).
Sem `rotulo`, o selo aparece como "Conteúdo" — assim nenhum cartão encolhido fica sem identificação.

## O que ainda não encolhe

- Cartões da biblioteca (`src/components/ui/card.tsx`) em telas que **não** estão dentro de
  um painel: Equipe, Configurações, Empresa, Configuração de OS, Permissões, Assinatura,
  Pedidos de Compra, Notificações, Importar XML de NF-e, Nova NFS-e, devoluções/complementares
  de NF-e, Suporte, Wiki. Nessas telas é preciso (a) colocar a tela no painel personalizável ou
  (b) trocar o `Card` por um cartão com acordeão — arquivos de `ui/` não devem ser editados.
- O estado de encolhido é por sessão de tela (não é gravado). Se quiser que fique salvo por
  usuário e por tela, como já acontece com a ordem dos blocos, é só pedir.
