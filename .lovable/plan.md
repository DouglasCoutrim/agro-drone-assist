# Corrigir o salvamento da comissão da equipe

## Diagnóstico confirmado

A tela envia corretamente as configurações de comissão do técnico, e o acesso à edição já é exibido somente para administradores. O banco também possui uma regra que permite ao administrador atualizar perfis da própria empresa.

O bloqueio vem de uma proteção posterior no banco: ela rejeita qualquer alteração nos campos de comissão feita por um usuário autenticado, inclusive quando esse usuário é o administrador autorizado. Essa proteção substituiu a regra anterior, que bloqueava técnicos, mas permitia administradores.

## Implementação

1. Ajustar a proteção dos perfis para:
   - permitir que administradores alterem comissões de colaboradores da própria empresa;
   - permitir a administração global quando aplicável;
   - continuar bloqueando técnicos e demais usuários de alterarem comissões;
   - continuar impedindo mudanças indevidas de vínculo entre empresas.
2. Usar comparações seguras para valores vazios e manter as regras atuais de isolamento entre empresas.
3. Manter o formulário atual e exibir uma mensagem amigável caso o banco recuse uma alteração.

## Validação

- Salvar comissão percentual e fixa para serviços e peças como administrador.
- Confirmar que os valores persistem após recarregar a página.
- Confirmar que um usuário sem papel de administrador não consegue alterar sua própria comissão diretamente.
- Confirmar que um administrador não consegue alterar um colaborador de outra empresa.
- Verificar a tela no celular e a compilação do aplicativo.
