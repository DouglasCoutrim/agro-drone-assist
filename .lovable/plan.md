# Corrigir o salvamento de ajudantes na OS

## Resultado esperado
Ao adicionar um ajudante e salvar a ordem de serviço, o vínculo e a comissão devem ser gravados e aparecer novamente ao abrir a OS, sem o erro mostrado na captura.

## Etapas
1. Ajustar o salvamento dos ajudantes para enviar somente os campos que existem na tabela e manter a identificação da empresa pela própria OS, com as regras de acesso já aplicadas no banco.
2. Ajustar a leitura dos ajudantes para não filtrar por um campo inexistente; consultar pela OS e preservar a proteção por empresa definida no acesso aos dados.
3. Exibir a confirmação de sucesso somente após todos os dados da OS serem salvos; se a etapa dos ajudantes falhar, deixar claro que a OS principal já foi gravada.
4. Testar a edição de uma OS com ajudante, reabri-la para conferir nome e comissão, e verificar a prévia no celular e os erros de compilação.

## Detalhes técnicos
A consulta ao banco confirmou que `public.os_tecnicos_ajudantes` não tem coluna `organization_id`. O formulário em `src/pages/OrdensServico.tsx` envia esse campo no INSERT e o usa como filtro no SELECT, o que explica a mensagem de erro e também pode impedir a recarga dos ajudantes. A tabela relaciona cada ajudante a `ordens_servico` por `ordem_servico_id`; as políticas de INSERT/DELETE/SELECT verificadas consultam essa OS para autorizar o acesso. Portanto, não é necessário criar uma coluna ou afrouxar as políticas de segurança para corrigir esse erro.
