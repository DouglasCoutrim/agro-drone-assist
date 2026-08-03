# Acesso de leitura ao backend (para o agente do Cursor)

Este projeto roda no **Lovable Cloud**. Não existe access token de conta Supabase
nem senha do banco disponíveis para você — logo, `supabase link`, `supabase db pull`
e conexão direta via `psql` **não são possíveis**.

Para ler dados e testar queries a partir do Cursor, use a API pública do projeto
com um usuário real. A RLS continua ativa: você enxerga exatamente o que aquele
usuário enxerga.

## Configuração

`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` já estão no `.env` do repositório
(são públicos por design — a proteção real é a RLS).

Defina as credenciais de um usuário do app no seu shell (não commitar):

```bash
export TEST_EMAIL="voce@empresa.com"
export TEST_PASSWORD="sua-senha"
```

## Uso

```bash
node scripts/query.mjs clientes "nome,telefone" --limit 20
node scripts/query.mjs ordens_servico "numero,status,valor_final" --eq status=entregue
node scripts/query.mjs itens_estoque "codigo,descricao,quantidade" --order quantidade
node scripts/query.mjs ordens_servico --count
```

Flags:

| Flag | Descrição |
| --- | --- |
| `--limit N` | número máximo de linhas (default 20) |
| `--eq col=valor` | filtro de igualdade (pode repetir) |
| `--order col[:desc]` | ordenação |
| `--count` | retorna apenas a contagem |

O resultado sai em JSON no stdout; mensagens de status e erros de RLS vão para stderr.

## Limites

- **Somente leitura.** Escritas passam pelo app e pelas policies normais.
- **Migrações e mudanças de schema continuam sendo feitas no Lovable**, não pelo Cursor.
- A service role key e a senha do banco não são acessíveis no Lovable Cloud;
  não tente contorná-las afrouxando RLS ou concedendo acesso a `anon`.
