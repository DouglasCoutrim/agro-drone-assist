# Treinamento guiado: âncoras estáveis e conclusão somente quando aparece na tela

## Problema relatado

Ao clicar em "Iniciar treinamento" na Central de Ajuda, o treinamento pulava direto para
"Treinamento concluído".

## Causa

Os passos gravados em `wiki_articles.tour_steps` apontavam para seletores de CSS que existiam na
época em que a Wiki foi criada e que já não correspondem ao markup atual, por exemplo:

- `button.gradient-primary` (o botão "Novo Item" do Estoque hoje não usa essa classe);
- `.bg-card.border.border-border.rounded-2xl.shadow-soft.overflow-hidden` (os cartões passaram a
  usar `PremiumCard`);
- `.bg-muted\50.rounded-lg` (controle de margem global que não existe mais na tela).

Sem alvo, o react-joyride (v3) percorre todos os passos em sequência e encerra a tour com
`tour:end`/`finished`. Como o runner tratava `status === "finished"` como conclusão, o
treinamento era marcado como visto sem nunca ter destacado nada.

## Correções

### 1. Âncoras estáveis (`data-tour`) nas telas

Os destaques agora usam atributos `data-tour`, que não mudam quando o CSS é reformulado:

- Dashboard (`Index.tsx`): `dashboard-kpis`, `dashboard-os`, `dashboard-alertas`.
- Estoque (`Estoque.tsx`): `estoque-novo`, `estoque-indicadores`, `estoque-filtros`.
- Ordens de Serviço (`OrdensServico.tsx`): `os-nova`, `os-busca`, `os-lista`.
- Clientes (`Clientes.tsx`): `clientes-novo`, `clientes-busca`, `clientes-lista`.

As âncoras de lista/indicadores foram colocadas no mesmo elemento que já tem
`data-bloco` do painel personalizável, para continuarem visíveis mesmo com o bloco aberto.

### 2. Passos atualizados no banco

Os quatro treinamentos (`bem-vindo`, `controle-estoque`, `criando-primeira-os`,
`gestao-clientes`) tiveram `tour_steps` regravado com seletores `[data-tour="..."]` e textos
alinhados à tela atual.

### 3. Runner mais honesto (`HelpTourRunner.tsx`)

- Conta os destaques realmente exibidos (`tooltip`/`beacon`) e os alvos não encontrados
  (`error:target_not_found`).
- Fecha o treinamento só no `tour:end` (evento de fim de tour), não em qualquer evento com
  status `finished`.
- Se nada apareceu na tela, **não** registra como concluído: mostra "Não encontramos os
  destaques deste treinamento nesta tela. Tente novamente.".
- Se concluir com passos pulados, avisa que alguns destaques não estavam na tela.
- Falha ao gravar o progresso agora gera aviso em vez de passar em silêncio.
- O botão de fechar (X) encerra o treinamento (`closeButtonAction: "skip"`), em vez de avançar
  para o passo seguinte.
