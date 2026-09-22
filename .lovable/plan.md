# Permitir múltiplos papéis por usuário

## Resultado

Cada membro poderá ter um ou mais papéis simultaneamente: **Administrador**, **Técnico** e **Atendimento**. Exemplo: uma pessoa poderá ser Administrador e Técnico, mantendo os acessos administrativos e também os recursos próprios de técnico.

## Alterações

1. **Seleção de papéis na Equipe**
   - Substituir o seletor único por opções de múltipla escolha ao adicionar e editar membros.
   - Exibir todos os papéis atribuídos como identificadores visuais.
   - Exigir pelo menos um papel e impedir que o usuário remova de si próprio o último acesso administrativo.

2. **Cadastro e atualização segura**
   - Fazer a rotina de criação aceitar uma lista validada de papéis.
   - Gravar cada papel separadamente e desfazer o cadastro se qualquer etapa falhar.
   - Ao editar, adicionar e remover somente os papéis necessários, respeitando empresa, sessão e permissão administrativa.

3. **Acessos combinados no aplicativo**
   - Carregar todos os papéis do usuário autenticado.
   - Manter um papel efetivo para compatibilidade com as telas atuais, usando a prioridade Administrador → Técnico → Atendimento.
   - Considerar explicitamente a presença do papel Técnico em painéis, listas de técnicos, comissões e rotinas de cobrança, mesmo quando Administrador também estiver atribuído.

4. **Banco de dados e segurança**
   - Preservar a tabela separada de papéis e sua unicidade por usuário + papel.
   - Ajustar a função que retorna o papel efetivo para usar prioridade determinística, evitando resultado aleatório quando houver vários papéis.
   - Manter isolamento entre empresas e as regras de acesso existentes.

5. **Validação**
   - Testar cadastro e edição com Administrador + Técnico.
   - Confirmar os dois papéis na tela, acesso administrativo, presença nas áreas de técnico e funcionamento das comissões.
   - Conferir erros, compilação e comportamento em celular e computador.
