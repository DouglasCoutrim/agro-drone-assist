# Corrigir cadastro de usuários da equipe

## Diagnóstico confirmado

- A primeira tentativa criou `douglascoutrim@yahoo.com.br` corretamente, com perfil, papel de técnico, permissões e vínculo à empresa AGROTECHNICA.
- As tentativas seguintes retornaram HTTP 400 porque o mesmo e-mail já estava cadastrado.
- A tela substitui a mensagem real da função por “Edge Function returned a non-2xx status code”, fazendo um cadastro já concluído parecer uma falha.
- O erro de CORS do Asaas visto no console é independente do cadastro da equipe e não será alterado neste reparo.

## Alterações

1. **Mensagem correta na tela de equipe**
   - Ler o conteúdo da resposta de erro da função.
   - Exibir mensagens claras, como “Este e-mail já está cadastrado”, em vez do erro técnico genérico.
   - Atualizar a lista da equipe após uma resposta que indique usuário já vinculado à empresa.

2. **Cadastro seguro e consistente**
   - Validar nome, e-mail, senha e papel no servidor.
   - Confirmar que o administrador pertence a uma empresa antes de criar o membro.
   - Aceitar somente os papéis permitidos (`admin`, `tecnico`, `consulta`).
   - Verificar e tratar cada gravação de perfil, papel e permissões; não retornar sucesso quando alguma etapa falhar.
   - Remover a conta recém-criada se uma etapa posterior falhar, evitando usuários incompletos.
   - Nunca mover para outra empresa uma conta que já pertença a uma empresa diferente.

3. **Validação final**
   - Publicar a função corrigida.
   - Repetir o cadastro com um e-mail existente e confirmar a mensagem amigável, sem duplicação.
   - Validar um cadastro completo controlado e confirmar perfil, papel, permissões e empresa correta.
   - Conferir a tela da equipe e a compilação do app.
