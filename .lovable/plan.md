# Eliminar a página em branco do LivreOS publicado

## Diagnóstico confirmado
- `https://livreos.lovable.app/` continua totalmente em branco em um navegador novo e registra `supabaseUrl is required`; a prévia local abre normalmente.
- O arquivo JavaScript entregue pelo endereço publicado não contém a URL pública de conexão na inicialização do cliente. A única ocorrência dessa URL nele pertence a um arquivo de áudio, não à conexão. A versão local tem as configurações públicas necessárias.
- Uma tentativa anterior de restaurar a vinculação e republicar não eliminou o problema. Repetir somente a publicação não é uma correção verificável.

## Correção proposta
1. Garantir que a compilação da versão publicada receba a URL e a chave **públicas** do Lovable Cloud mesmo quando o ambiente de publicação omitir essas variáveis, sem alterar o cliente gerado, o arquivo `.env` ou usar segredos privados. Manter as variáveis gerenciadas como primeira opção e limitar o fallback à configuração pública deste projeto.
2. Confirmar que a compilação inclui a configuração de conexão e que a prévia continua abrindo a tela de entrada sem erros.
3. Publicar a versão corrigida e testar `https://livreos.lovable.app/` em navegador novo, tanto no computador quanto no celular: a tela de entrada deve aparecer e o erro `supabaseUrl is required` deve desaparecer.
4. Se a plataforma retirar também o fallback da versão publicada, reunir a evidência e encaminhar ao suporte da Lovable em vez de afirmar que a tela foi corrigida.

## Detalhe técnico
Usar configuração de compilação em `vite.config.ts` para fornecer somente valores públicos de URL e chave de publicação quando as variáveis gerenciadas estiverem ausentes no ambiente de publicação. Não incorporar credenciais de administrador nem alterar o controle de acesso existente.
