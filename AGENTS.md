# AGENTS.md — Projeto agro-drone-assist

## Armazenamento de imagens das OS (Supabase Storage)

As fotos anexadas nas ordens de serviço são gravadas no bucket **privado** `os-anexos`
do Supabase Storage, em uma pasta por empresa. Em `public.os_anexos` fica apenas o
registro + o **caminho** do objeto — nem URL pública, nem base64 no banco.

> **Histórico:** a primeira versão gravava na hospedagem via script PHP
> (`https://livreos.net/upload-os-image.php`) com FTP como fallback. Quando o
> `livreos.net` passou a servir o próprio SPA, qualquer caminho do domínio devolveu o
> `index.html` com HTTP 200, o `JSON.parse` da função quebrava e o upload morria em
> "Resposta inválida do servidor PHP". O caminho PHP/FTP está **retirado**: o arquivo
> `hosting/upload-os-image.php` foi **removido do repositório** em 2026-11-22 (tinha o
> `$SECRET` fixo no código) e a tabela `public.ftp_config` continua no banco sem nenhum
> leitor no código.

### Fluxo

1. Técnico clica em "Anexar Imagens" na OS → câmera do celular abre.
2. A imagem é comprimida no navegador (máx. 1200px, JPEG qualidade 0.7).
3. O navegador envia a imagem para a Edge Function `ftp-upload` via `fetch` (multipart).
4. A Edge Function autentica o JWT, confere que a OS é da empresa do usuário e sobe a
   imagem no bucket `os-anexos` em
   `{organization_id}/{ordem_servico_id}/{timestamp}_{arquivo}.jpg`, usando o token do
   **próprio usuário** (não a service role) para a policy de INSERT do bucket validar
   organização e papel.
5. A Edge Function grava o caminho do objeto em `public.os_anexos.url`.
6. A tela assina a leitura na hora (`createSignedUrls`, 7 dias) e usa a URL assinada no
   `<img>`; URL que expira não vira dado no banco. Excluir o anexo também remove o
   objeto do bucket.

### Estrutura dentro do bucket `os-anexos`

```
{organization_id}/          <- uma pasta por empresa
  {ordem_servico_id}/       <- uma pasta por OS
    {timestamp}_{arquivo}.jpg
```

O bucket é privado e as policies escopam por organização (`Org admin_tecnico upload`,
`Org members view`); excluir exige `admin`.

### Configuração

- Bucket `os-anexos` (privado). A policy de INSERT aceita caminho começando pela
  `organization_id` do usuário (ou pelo id da OS da organização); a de SELECT libera o
  `owner` do objeto e `admin`/`tecnico` da mesma organização.
- A policy de SELECT libera **qualquer membro da organização** dona do arquivo
  (policy `Org members veem anexos da organizacao`, criada em 2026-11-22), inclusive o
  papel `consulta`, que antes não conseguia assinar a URL e via a miniatura quebrada.
  A escrita continua exigindo `admin`/`tecnico`.
- `public.ftp_config` (linha `id = 1`) continua no banco apenas como histórico; nada
  mais a lê. A tabela está protegida (RLS ligada, sem policy, ACL só para `postgres` e
  `service_role`), por isso os valores de host/usuário/senha foram mantidos.

### Deploy

Função em `supabase/functions/ftp-upload/index.ts` — o nome é histórico; publicada
automaticamente ao salvar.

### Observações técnicas

- Extensão do arquivo é forçada para `.jpg` na Edge Function para evitar que um
  nome malicioso termine executável dentro da pasta pública (defesa em profundidade).
- Limite de 5 MB por imagem; a compressão no navegador mantém bem abaixo disso.
- A exclusão de um anexo apaga a linha em `os_anexos` e, em seguida, o objeto no
  bucket; se a remoção do objeto falhar, sobra um objeto órfão (a linha já foi apagada).

## Segurança no banco

- Função `SECURITY DEFINER` roda como o dono e **ignora a RLS**: se ela for exposta
  pela API, todo o controle de acesso precisa estar dentro dela. Antes de criar ou
  alterar uma, conferir a ACL em `pg_proc.proacl` — `=X/postgres` é o PUBLIC (qualquer
  role, inclusive `anon`) e `anon=X` deixa visitante sem login executar.
- RPC privilegiada termina com `REVOKE ALL ... FROM public, anon` e um `GRANT EXECUTE`
  só para quem realmente chama (`authenticated` e/ou `service_role`).
- RPC que recebe id de OS ou de empresa compara a organização do dono com
  `public.get_user_org_id(auth.uid())`. `auth.uid()` nulo é o caminho de Edge
  Function/cron (`service_role`) e `public.is_platform_admin(auth.uid())` é a exceção
  do admin da plataforma. Modelo: `os_commission_calc` / `os_commission_core`
  (guarda acrescentada em 2026-11-22).
- Edge Function nova importa `corsHeaders` de `_shared/cors.ts`; nenhuma devolve
  `Access-Control-Allow-Origin: '*'`. O helper ecoa apenas a **primeira** origem de
  `ALLOWED_ORIGIN`, então origem que não esteja nessa lista não é atendida.

## Histórico de migrations

Existem duas pastas de migrations e elas **não** são equivalentes:

- `drizzle/migrations/` — pasta em que o projeto **escreve** (0000 a 0029). É o registro das
  mudanças feitas aqui. O `meta/_journal.json` e os snapshots param no `0023`: de `0024` em diante
  os arquivos são escritos à mão, sem `drizzle-kit generate`.
- `supabase/migrations/` — 88 arquivos gerados pelo CLI, congelados em 2026-10-03. Fica como
  **arquivo morto**: nada é acrescentado nem apagado ali.

Consequências práticas:

- O banco **não** tem esquema de controle de migrations (`supabase_migrations` não existe): o que
  está aplicado só se sabe inspecionando objetos.
- **Não rode `supabase db push`** contra produção: sem histórico no banco ele tentaria reaplicar os
  88 arquivos antigos.
- **Não rode `drizzle-kit generate`**: o snapshot para no `0023`, então ele diffs a partir dali e
  reemitiria mudanças já aplicadas.
- Mudança de banco se faz escrevendo `supabase/APROVACAO_*.sql`, mostrando o SQL, aplicando com
  aprovação e registrando o mesmo comando em `drizzle/migrations/NNNN_*.sql`.
- A migration `supabase/migrations/20260618123536_...sql` tem `TRUNCATE` de 23 tabelas e
  `DELETE FROM auth.users`, mas é **opt-in**: só executa com `platform_config.allow_full_reset`
  ligado, e essa tabela não existe no banco. Rodá-la hoje não apaga nada.