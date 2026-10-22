# Orçamento único agrupando várias OS do mesmo cliente

## O que o usuário verá
- Na lista de Ordens de Serviço, um botão **"Agrupar em orçamento"**. Ao clicar, escolhe-se o cliente e aparecem todas as OS dele (abertas/não entregues por padrão, com opção de ver todas), com caixas de seleção.
- Uma tela de revisão mostra, para cada OS selecionada: número, equipamento (tipo, marca, modelo, nº de série), defeito relatado, diagnóstico e itens (peças e serviços) com subtotal.
- Campos finais: desconto geral, validade e observação para o cliente. Resumo com subtotal por OS, subtotal geral, desconto e **TOTAL**.
- Ações: **Baixar PDF** e **Enviar por WhatsApp** (mesmo fluxo de envio já usado nos orçamentos), e **Salvar orçamento**, que grava o orçamento agrupado na tela de Orçamentos com referência às OS incluídas.

## PDF organizado
- Cabeçalho com logo, dados da empresa, "ORÇAMENTO CONSOLIDADO Nº ...", data, validade e dados do cliente.
- Tabela-resumo no início: uma linha por OS (nº, equipamento, valor).
- Um bloco por OS: título com nº e equipamento, defeito/diagnóstico, tabela de itens, subtotal.
- **Sem quebras ruins:** antes de desenhar cada bloco, o sistema mede a altura dele; se não couber no espaço restante da página, começa na página seguinte. Blocos maiores que uma página inteira são divididos por linhas da tabela, repetindo o cabeçalho da tabela e a indicação "OS-XXXX (continuação)". O bloco de totais e as assinaturas nunca ficam separados.
- Rodapé em todas as páginas: "Página X de Y", nome da empresa; termos e condições ao final.
- Somente informações para o cliente: nada de ajudantes, comissões ou observações internas.

## Detalhes técnicos
- Novo `src/lib/orcamento-consolidado-pdf.ts` com jsPDF (já usado em `orcamento-pdf.ts`), com funções `measureBlock()` / `ensureSpace()` para paginação controlada e rodapé numerado na segunda passagem.
- Novo `src/components/os/AgruparOSDialog.tsx` (Dialog no desktop, Sheet no celular): seleção de cliente, lista de OS via `useOrganization`, carregamento de `itens_os` das OS escolhidas.
- Salvamento em `orcamentos`: `cliente_id`, `equipamento` = lista resumida dos equipamentos, `itens` jsonb com os itens agrupados incluindo `os_numero`/`ordem_servico_id` por item, `valor`, `desconto`, `validade`, `status` "pendente"; `ordem_servico_id` fica nulo e as OS ficam registradas no jsonb (sem mudança de banco).
- Tela de Orçamentos passa a reconhecer orçamentos agrupados (selo "Agrupado · N OS") e regenerar o mesmo PDF.
- Validação: gerar PDF com 1, 3 e muitas OS (incluindo uma com muitos itens), converter as páginas em imagem e conferir que não há bloco cortado nem espaço vazio indevido; testar no computador e no celular.
