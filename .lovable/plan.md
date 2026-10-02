# Corrigir o salvamento da comissão da equipe

## Diagnóstico confirmado

A tela envia corretamente as configurações de comissão e já mostra esse controle quando o perfil possui o papel Técnico e quem está editando possui o papel Administrador. Isso inclui o mesmo usuário com os dois papéis. O banco também possui uma regra que permite ao administrador atualizar perfis da própria empresa.

O bloqueio vem de uma proteção posterior no banco: ela rejeita qualquer alteração nos campos de comissão feita por um usuário autenticado, inclusive quando esse usuário é o administrador autorizado. Essa proteção substituiu a regra anterior, que bloqueava técnicos, mas permitia administradores.

## Implementação

1. Ajustar a proteção dos perfis para:
   - permitir salvar comissões quando o perfil possui Técnico e o responsável pela alteração possui Administrador, inclusive quando ambos os papéis pertencem ao mesmo usuário;
   - continuar bloqueando usuários que tenham apenas Técnico ou outro papel sem Administrador;
   - continuar impedindo mudanças indevidas de vínculo entre empresas.
2. Usar comparações seguras para valores vazios e manter as regras atuais de isolamento entre empresas.
3. Manter o formulário atual e exibir uma mensagem amigável caso o banco recuse uma alteração.

## Validação

- Salvar comissão percentual e fixa para serviços e peças em um perfil com Técnico + Administrador.
- Confirmar que os valores persistem após recarregar a página.
- Confirmar que um usuário somente Técnico não consegue alterar sua própria comissão diretamente.
- Confirmar que um administrador não consegue alterar um colaborador de outra empresa.
- Verificar a tela no celular e a compilação do aplicativo.
