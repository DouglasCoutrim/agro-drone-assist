# Corrigir edição e salvamento das ordens de serviço

## O que foi confirmado
- Na OS-00004, o valor de R$ 8.097,00 está salvo no campo de orçamento da ordem, mas **não há registros de peças ou serviços vinculados**. Por isso o formulário mostra total R$ 0,00; a lista de ordens exibe o orçamento antigo.
- Outras ordens da mesma empresa também têm orçamento sem itens. Não é seguro inventar lançamentos a partir do valor total.
- Ao salvar, a tela atualiza a OS e depois exclui e recria itens, checklist e ajudantes em chamadas separadas. A origem exata do erro de campo obrigatório ainda não foi confirmada pelos registros disponíveis.

## Plano
1. Reproduzir a edição e identificar a operação e o campo que falham no salvamento; verificar se há fonte recuperável dos itens da OS-00004, sem alterar dados reais durante o diagnóstico.
2. Exibir de forma coerente o orçamento já salvo quando a OS não possui itens, distinguindo-o do total calculado por peças e serviços. Ao abrir para edição, avisar que não existem lançamentos detalhados, em vez de sugerir que R$ 8.097,00 veio de itens carregados.
3. Corrigir a validação e o salvamento conforme o erro confirmado. Impedir que uma falha de carregamento seja tratada como lista vazia e que o salvamento apague lançamentos existentes sem confirmação. Preservar orçamento legado e evitar atualizações parciais silenciosas.
4. Validar no celular e no computador: abrir OS com e sem itens, conferir os valores, salvar uma edição sem perda de dados e verificar mensagens claras caso falte algum campo. Se houver dados recuperáveis da OS-00004, restaurá-los somente após confirmar sua origem; caso contrário, manter R$ 8.097,00 como orçamento e permitir cadastrar o detalhamento real.

## Detalhes técnicos
- Revisar a leitura de `itens_os`, o cálculo de `valor_orcamento` e o fluxo de gravação em `OrdensServico.tsx`.
- Conferir a resposta real da operação que falha antes de mudar regras ou estrutura do banco. Preservar o isolamento por empresa e as permissões existentes.
