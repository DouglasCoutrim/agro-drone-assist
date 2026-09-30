# Preço de venda livre no estoque

## Resultado esperado
- No cadastro e na edição de itens de estoque, o usuário informa separadamente o custo unitário e o preço final de venda, sem porcentagem automática.
- Os preços já cadastrados permanecem como estão.

## Alterações
1. Remover o campo de margem e a ação de aplicar porcentagem a todos os produtos, evitando alterações involuntárias de preços existentes.
2. Deixar o campo de preço de venda editável no formulário; mudar o custo não deve alterar o preço informado. Manter os dois valores independentes ao salvar e ao editar.
3. Evitar precificação automática também na importação do Mercado Livre: exigir o preço de venda informado no fluxo de importação, em vez de calcular uma margem padrão; impedir gravação sem esse valor. Preservar a importação CSV, que já recebe custo e preço em colunas separadas.
4. Atualizar o texto público que anuncia precificação por margem, pois essa função deixará de existir.
5. Validar criação e edição de produto com custo e preço independentes, a visualização dos valores e a ausência de recálculo em itens antigos.

## Detalhes técnicos
- Ajustar `Estoque.tsx` para retirar estado, armazenamento local e rotinas de margem, conservando o salvamento atual de `custo_unitario` e `preco_venda`.
- Ajustar `mercadolivre-import/index.ts` para não aplicar os 30% implícitos; validar o valor de venda fornecido antes da inserção. Não alterar tabelas nem preços históricos.
