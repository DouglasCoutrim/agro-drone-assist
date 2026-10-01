# Manter ajudantes e comissões apenas no controle interno

## Resultado esperado
A equipe pode registrar e consultar técnicos ajudantes e suas comissões dentro da OS, mas o cliente não recebe esses nomes nem valores no PDF, na impressão ou no envio por WhatsApp.

## Etapas
1. Manter a seção de ajudantes e comissões na edição e na visualização interna da OS, sem confundi-la com o documento destinado ao cliente.
2. Revisar e proteger as saídas destinadas ao cliente para que dados internos de ajudantes e comissões não sejam incluídos, inclusive quando a OS é impressa ou compartilhada.
3. Conferir com uma OS que tenha ajudante e comissão cadastrados: os dados permanecem visíveis internamente e ausentes do PDF e da mensagem enviada ao cliente.

## Detalhes técnicos
A leitura do código confirmou que `OSAssistantsSection` aparece no formulário e na visualização da OS, enquanto impressão e compartilhamento usam `generateOSPDF`; esse gerador não inclui ajudantes nem campos `commission_assistants_*`. A mensagem de WhatsApp também usa apenas dados básicos da OS. Preservar essa separação e validá-la sem alterar o cálculo, o armazenamento ou as regras de acesso existentes. O nome do técnico responsável e o total cobrado pela OS são informações distintas das do ajudante e permanecem no documento do cliente.
