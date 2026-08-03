# Acesso de leitura ao backend a partir do Cursor

## Correção de build pendente

`src/pages/OrdensServico.tsx` usa o tipo `CustomType` sem importá-lo, quebrando o build. Correção: adicionar `import type { CustomType } from "@/lib/equipment-segments";` junto aos imports existentes desse módulo.


## Contexto

O projeto roda no Lovable Cloud. O access token de conta Supabase e a senha do banco não existem do seu lado — não há dashboard Supabase associado, e a service role key / senha do banco não são expostas. Portanto `supabase link` e conexão direta via psql com senha não são possíveis.

O caminho viável para o agente do Cursor ler dados e testar queries é usar a **API pública do projeto** (URL + chave publicável, ambas já presentes no `.env` e já embarcadas no app), autenticando com um usuário real. A RLS continua aplicada, então o agente enxerga exatamente o que aquele usuário enxerga — o que é o comportamento correto para um SaaS multi-tenant.

## O que será criado

Um script utilitário no repositório, `scripts/query.mjs`, que o agente do Cursor executa localmente:

- Lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do `.env`.
- Lê `TEST_EMAIL` e `TEST_PASSWORD` do ambiente local (não commitados) e faz `signInWithPassword`.
- Aceita uma consulta em formato PostgREST via argumentos, por exemplo:
  - `node scripts/query.mjs clientes "nome,telefone" --limit 20`
  - `node scripts/query.mjs ordens_servico "numero,status,valor_final" --eq status=entregue`
- Imprime o resultado em JSON, e imprime o erro da RLS de forma legível quando o acesso é negado.

Também será adicionado `scripts/README.md` curto explicando:
- como definir `TEST_EMAIL` / `TEST_PASSWORD` no shell do Cursor;
- que a chave publicável é pública por design e a proteção real é a RLS;
- que mudanças de schema e migrações continuam sendo feitas aqui no Lovable, não pelo Cursor.

## O que NÃO será feito

- Nenhuma exposição de service role key ou senha de banco (não disponíveis no Cloud).
- Nenhum enfraquecimento de RLS ou grant para `anon` para facilitar a leitura.
- Nenhuma alteração no app em si.

## Detalhes técnicos

- `scripts/query.mjs` em Node ESM usando `@supabase/supabase-js` (já é dependência do projeto).
- Carregamento do `.env` via `node --env-file=.env` ou parsing manual simples, sem nova dependência.
- Sessão em memória (`persistSession: false`), sem gravar tokens em disco.
