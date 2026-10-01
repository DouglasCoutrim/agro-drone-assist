# Corrigir atualizações presas em cache

## Objetivo
Garantir que alterações publicadas apareçam normalmente no navegador e no aplicativo instalado, preservando o acesso pelo ícone da tela inicial e sem adicionar modo offline.

## Diagnóstico confirmado
- A configuração de produção ainda gera um Service Worker em `/sw.js` com atualização automática, embora o código principal declare que não deve registrar cache do aplicativo.
- Os dois manifestos existentes já oferecem instalação na tela inicial para o LivreOS e para o painel administrativo; isso pode continuar funcionando sem Service Worker.
- O Vite já gera arquivos JavaScript e CSS com hash, portanto não é necessário duplicar essa configuração.
- O guia não deve ser aplicado literalmente: o script baseado em `Date.now()` pode recarregar a página continuamente, apagar todos os caches pode atingir recursos não relacionados, e tags HTML de cache não substituem os cabeçalhos do servidor.

## Implementação
1. **Desativar a geração de novos caches do aplicativo**
   - Remover a configuração do plugin PWA responsável pelo Service Worker.
   - Remover referências e dependências que ficarem sem uso.
   - Manter os manifestos, ícones e atalhos instaláveis atuais.

2. **Encerrar com segurança o Service Worker já publicado**
   - Publicar temporariamente um arquivo substituto no mesmo caminho `/sw.js`.
   - Esse arquivo apagará somente os caches pertencentes ao antigo Workbox, atualizará as páginas abertas e removerá o próprio registro.
   - Não adicionar limpeza global de cache, recarga em ciclo ou comandos manuais para cada usuário.

3. **Preservar o comportamento da prévia e do desenvolvimento**
   - Não registrar Service Worker na prévia, em desenvolvimento ou dentro do editor.
   - Manter a atualização instantânea já fornecida pelo ambiente, sem alterar portas ou forçar limpeza do cache de pacotes.

4. **Registrar e validar a mudança**
   - Documentar a decisão técnica e atualizar o acompanhamento da tarefa.
   - Confirmar compilação, tipos e lint.
   - Verificar em navegador desktop e celular que o app abre, os manifestos continuam acessíveis e nenhum novo Service Worker do aplicativo é registrado na prévia.
   - Conferir no resultado de produção que `/sw.js` contém somente a rotina temporária de desligamento e que os arquivos gerados continuam versionados por hash.

## Resultado esperado
- Novas versões deixam de ficar presas no cache antigo.
- Usuários que já possuem o Service Worker recebem a limpeza quando o navegador buscar `/sw.js` novamente.
- O LivreOS continua podendo ser adicionado à tela inicial, mas passa a depender de internet; não haverá suporte offline.

## Observação de publicação
O arquivo de desligamento deve permanecer publicado por pelo menos um ciclo de versão para alcançar instalações antigas. Depois desse período, ele poderá ser removido em uma manutenção posterior.
