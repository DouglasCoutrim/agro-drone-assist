# Remover cadastros rápidos de itens nas ordens e orçamentos

## Objetivo
Evitar que peças, produtos ou serviços sejam cadastrados de forma incompleta durante o lançamento de uma ordem de serviço ou orçamento. O cadastro de novos itens fica nas telas próprias de **Estoque** e **Serviços**.

## Alterações
1. Retirar a opção “Cadastrar” da busca de peças/produtos e serviços usada nas ordens de serviço e nos orçamentos, inclusive a janela de cadastro rápido. Manter a busca, seleção e edição de quantidade e valor dos itens já encontrados.
2. No campo “Equipamento / Objeto” do orçamento, manter a digitação livre e a escolha de sugestões, mas retirar “Adicionar ao catálogo”, que hoje cria um produto a partir desse campo.
3. Quando a busca não encontrar um item, exibir uma indicação curta para cadastrá-lo em **Estoque** (peças/produtos) ou **Serviços** (serviços), sem criar registros a partir do lançamento.
4. Validar criação e edição de OS e orçamentos, inclusive no celular: selecionar itens existentes, preencher o equipamento livremente e confirmar que nenhum cadastro rápido permanece nessas telas.

## Detalhes técnicos
- A seção compartilhada de itens (`OSItemsSection`) atende tanto OS quanto orçamento; a remoção ali cobre os dois fluxos.
- O campo de equipamento do orçamento usa `CatalogAutocomplete`; desativar sua ação de criação nesse uso, preservando entrada de texto e seleção.
- Nenhuma alteração no banco ou nos itens já cadastrados. O catálogo de produtos usado atualmente na busca das OS/orçamentos (`produtos`) é separado do estoque (`itens_estoque`): esta mudança impede novos cadastros incompletos, mas não unifica nem migra os dois catálogos. Essa integração exigiria uma decisão e trabalho separados.
