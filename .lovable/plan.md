# Restaurar a conexão do aplicativo publicado

## Diagnóstico confirmado
- O erro foi reproduzido em `livreos.lovable.app`: a página fica vazia e registra `supabaseUrl is required`.
- A versão publicada não recebeu a configuração necessária para inicializar a conexão com o banco.
- A prévia possui as três configurações esperadas e acessa os dados normalmente.
- O backend hospedado está disponível e saudável; a falha está na configuração usada durante a publicação, não no banco.
- O cliente de conexão é gerado automaticamente e está correto; não deve ser editado nem receber endereço ou chave fixos no código.

## Implementação
1. Restaurar a vinculação das configurações públicas do backend ao ambiente de publicação.
2. Confirmar que as variáveis de conexão continuam presentes no ambiente do projeto, sem revelar ou duplicar seus valores.
3. Gerar uma nova publicação para substituir o arquivo JavaScript defeituoso.
4. Abrir o endereço publicado em um navegador novo e validar:
   - a tela inicial aparece em vez da página vazia;
   - não ocorre mais `supabaseUrl is required`;
   - a conexão com autenticação e dados responde normalmente;
   - a rotina temporária de limpeza do cache não interfere na nova versão.
5. Se a publicação ainda sair sem configuração, interromper novas mudanças no aplicativo e tratar a vinculação do ambiente como falha da plataforma, preservando o código atual.

## Resultado esperado
O endereço publicado volta a abrir normalmente e usa a conexão existente do projeto, sem expor credenciais nem alterar dados.
