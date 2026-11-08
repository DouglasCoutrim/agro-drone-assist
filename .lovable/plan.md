# Migrar o LivreOS para um Supabase externo

## Limite importante
Este projeto usa o Lovable Cloud, e ele não pode ser desligado neste projeto. Para usar um Supabase seu, o caminho é copiar tudo para a sua conta e apontar o app para ela. O Lovable Cloud continua existindo, mas fica sem uso.

## Etapas

1. **Criar o projeto no Supabase (você)**
   - Crie um projeto em supabase.com, de preferência na região São Paulo.
   - Guarde a URL, a chave pública (anon), a senha do banco e o Project ID.

2. **Recriar a estrutura do banco (eu preparo)**
   - Junto todas as migrações do projeto em um único script, na ordem certa: tabelas, regras de acesso (RLS), funções, gatilhos e pastas de arquivos (logos, avatars, wiki-media).
   - Você roda esse script no SQL Editor do seu Supabase.

3. **Copiar os dados**
   - Exportação de cada tabela em CSV feita pelo painel Backend do Lovable Cloud, ou um script de cópia que eu preparo.
   - Os usuários entram por um script à parte. As senhas não podem ser exportadas, então cada usuário vai precisar usar "Esqueci a senha" no primeiro acesso.
   - Os arquivos (logos e fotos) são baixados e enviados de novo para as pastas do novo projeto.

4. **Implantar as funções do servidor**
   - São elas: api, Focus NF-e/NFS-e, nfes-recebidas, webhooks Asaas, send-web-push, buscar-imagem-produto e Mercado Livre.
   - O deploy é feito com o Supabase CLI: `supabase functions deploy`.
   - É preciso cadastrar de novo os segredos: tokens da Focus, chave do Firecrawl, chaves VAPID do push, WEBHOOK_SECRET e Asaas.

5. **Apontar o app para o novo banco**
   - Atualizar as variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID` e o fallback no `vite.config.ts`.
   - Isso vale para a hospedagem na Hostinger ou para um remix do projeto conectado ao Supabase externo.
   - Atualizar as URLs de webhook na Focus e no Asaas e os endereços de login (domínio livreos.net).

6. **Validar**
   - Fazer login, abrir uma OS, uma venda e o PDV, testar o push e emitir uma nota em homologação.

## Detalhes técnicos
- As migrações estão em `supabase/migrations` e `drizzle/migrations`. Eu consolido as duas em `/mnt/documents/livreos_schema.sql`.
- Também gero `/mnt/documents/livreos_dados.sql` com INSERTs das tabelas públicas, lidos com consultas de leitura.
- O gatilho de push chama a URL da função; ela precisa ser trocada para a URL do novo projeto.
- Nenhum arquivo de código do app muda nesta fase. A troca de variáveis acontece só na etapa 5, quando você aprovar.
