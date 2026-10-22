# Peças do estoque na OS e cadastro completo a partir da OS

## Causa
A busca de peças na OS consulta o catálogo antigo de "produtos". O cadastro de **Estoque** grava em outra lista. Por isso, as peças cadastradas no estoque não aparecem na OS.

## Alterações
1. **Busca de peças pelo estoque**
   - Na OS e no orçamento, procurar peças e produtos no **Estoque** da empresa, pelo nome ou pelo código.
   - Exibir código, categoria, preço de venda e a quantidade disponível.
   - Itens já lançados no catálogo antigo continuam aparecendo e abrindo normalmente nas OS existentes.

2. **Cadastrar quando não houver resultado**
   - Peça/produto: botão "Cadastrar no estoque". Ele abre o **mesmo formulário completo do Estoque** (código automático, categoria, fornecedor, custo, preço de venda, quantidade, estoque mínimo, localização), já com o nome digitado.
   - Serviço: botão "Cadastrar serviço". Ele abre o **mesmo formulário completo de Serviços** (tipo de cobrança, valor fixo ou por hora, tempo estimado).
   - Depois de salvar, o item aparece no Estoque ou em Serviços e já entra na OS, sem perder o que estava preenchido.
   - Custo e preço de venda continuam independentes, sem cálculo automático de margem.

3. **Validação**
   - Uma peça cadastrada no estoque aparece na busca da OS.
   - Cadastrar uma peça pela OS a faz aparecer no Estoque, na categoria escolhida.
   - Cadastrar um serviço pela OS o faz aparecer em Serviços.
   - Editar uma OS antiga mantém os itens já lançados.
   - Testar no computador e no celular.

## Detalhes técnicos
- Migração: adicionar `item_estoque_id uuid` (FK `itens_estoque.id`, nullable) em `itens_os`. `produto_id` continua existindo para os lançamentos antigos. A RLS atual por organização segue valendo.
- `OSItemsSection`: buscar em `itens_estoque` (`descricao`/`codigo`, `organization_id`) e gravar `item_estoque_id`. Manter a leitura de `produto_id` para itens legados.
- Extrair os formulários de `Estoque.tsx` e `Servicos.tsx` para componentes reutilizáveis, com `onSaved(item)`. Abri-los em Dialog/Sheet dentro da OS e do orçamento, preservando o retry de código `23505`.
- Ajustar o salvamento por identidade em `OrdensServico.tsx` e o JSON `itens` de `Orcamentos.tsx` para incluir `item_estoque_id`.
- Fora do escopo: dar baixa automática no estoque ao lançar peças na OS (fica para uma decisão separada).
