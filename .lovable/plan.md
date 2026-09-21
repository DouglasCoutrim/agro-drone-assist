# Corrigir cadastro de usuários da equipe

## Diagnóstico confirmado

- Os registros confirmam que as tentativas com o e-mail ainda novo foram recusadas porque a senha foi identificada como fraca e fácil de adivinhar.
- Uma tentativa posterior foi aceita e criou `douglascoutrim@yahoo.com.br` com perfil, papel de técnico, permissões e vínculo à empresa AGROTECHNICA.
- A tela esconde a explicação real (“escolha uma senha mais forte”) e mostra apenas “Edge Function returned a non-2xx status code”.
- O console também mostra um erro independente de origem permitida na consulta automática ao Asaas.

## Alterações

1. **Mensagem correta na tela de equipe**
   - Ler o conteúdo da resposta de erro da função.
   - Traduzir recusas conhecidas em mensagens claras, especialmente senha fraca e e-mail já cadastrado.
   - Orientar os requisitos de senha antes do envio para evitar tentativas que serão recusadas.

2. **Cadastro seguro e consistente**
   - Validar nome, e-mail, senha e papel no servidor.
   - Confirmar que o administrador pertence a uma empresa antes de criar o membro.
   - Aceitar somente os papéis permitidos (`admin`, `tecnico`, `consulta`).
   - Verificar e tratar cada gravação de perfil, papel e permissões; não retornar sucesso quando alguma etapa falhar.
   - Remover a conta recém-criada se uma etapa posterior falhar, evitando usuários incompletos.
   - Nunca mover para outra empresa uma conta que já pertença a uma empresa diferente.

3. **Eliminar o erro paralelo do Asaas**
   - Corrigir os cabeçalhos de acesso da função para aceitar chamadas do app publicado e da prévia.
   - Manter a validação de sessão e o isolamento das credenciais por empresa.

4. **Validação final**
   - Publicar a função corrigida.
   - Testar uma senha recusada e confirmar a mensagem amigável sem criar conta.
   - Repetir com um e-mail existente e confirmar a mensagem específica, sem duplicação.
   - Validar um cadastro completo controlado e confirmar perfil, papel, permissões e empresa correta.
   - Confirmar que a consulta automática ao Asaas não gera mais bloqueio de origem.
   - Conferir a tela da equipe e a compilação do app.
