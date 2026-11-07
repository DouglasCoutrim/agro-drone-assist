# Foto do produto buscada na internet

Sim, é possível. O sistema procura a foto pela descrição do produto e guarda só o **link** dela, sem salvar a imagem.

Observação: hoje existe uma regra no projeto dizendo que toda imagem deve ficar salva no sistema. Este pedido abre uma exceção só para fotos de produtos do estoque, e a regra será atualizada.

## O que o usuário vai ver
1. **Na lista do Estoque**: ao passar o mouse sobre o produto (ou tocar no ícone de foto, no celular), aparece uma janelinha com a foto.
2. **Na tela do produto**: a foto aparece no topo, com os botões:
   - **Buscar foto**: mostra até 6 opções achadas na internet para você escolher a certa.
   - **Trocar** / **Remover**.
3. **Busca automática**: produtos sem foto podem ser buscados em lote com o botão "Buscar fotos" no Estoque. O sistema escolhe a primeira opção, e você pode corrigir depois.
4. Se o site de origem tirar a imagem do ar, aparece um ícone padrão e a opção de buscar de novo.

## Limitações
- A busca usa um serviço de pesquisa na web, que tem custo por busca e precisa ser conectado (vai aparecer um cartão para você autorizar).
- A foto automática pode vir errada quando a descrição é muito genérica. Por isso dá para escolher entre as opções.
- Algumas fotos podem ter direitos autorais do site de origem.

## Detalhes técnicos
- Conector Firecrawl (search com `sources: ["images"]`) chamado pela Edge Function `buscar-imagem-produto`, que valida a sessão e a organização e devolve até 6 URLs https.
- Nova coluna `imagem_url` (text, nula) em `itens_estoque`; só a URL é gravada.
- Componente `ProductImageHover` (HoverCard, com imagem em lazy-load e fallback para ícone) na lista do Estoque e prévia na tela/diálogo do produto; `ImagePickerDialog` para escolher entre as opções.
- Lote: no máximo 20 itens por clique, sequencial, para controlar o custo.
- Atualizar a memória "Gestão de Mídia" com a exceção para links de fotos do estoque.
