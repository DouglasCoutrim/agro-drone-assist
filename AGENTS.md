# AGENTS.md — Projeto agro-drone-assist

## Armazenamento de imagens das OS (Supabase Storage)

As fotos anexadas nas ordens de serviço são gravadas no bucket **privado** `os-anexos`
do Supabase Storage, em uma pasta por empresa. Em `public.os_anexos` fica apenas o
registro + o **caminho** do objeto — nem URL pública, nem base64 no banco.

> **Histórico:** a primeira versão gravava na hospedagem via script PHP
> (`https://livreos.net/upload-os-image.php`) com FTP como fallback. Quando o
> `livreos.net` passou a servir o próprio SPA, qualquer caminho do domínio devolveu o
> `index.html` com HTTP 200, o `JSON.parse` da função quebrava e o upload morria em
> "Resposta inválida do servidor PHP". O caminho PHP/FTP está **retirado**: a tabela
> `public.ftp_config` e o arquivo `hosting/upload-os-image.php` ficam apenas como
> histórico e não são mais lidos pelo app.

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
- **Limite conhecido:** como a policy de SELECT do bucket exige `is_admin_or_tecnico`,
  usuário com papel `consulta` vê o registro em `os_anexos` mas não consegue assinar a
  URL — a miniatura não carrega para ele. Abrir isso é decisão de negócio (mexe em
  policy de storage), não foi alterado.
- `public.ftp_config` (linha `id = 1`) e `hosting/upload-os-image.php` continuam no
  projeto apenas como histórico; nada mais os lê.

### Deploy

Função em `supabase/functions/ftp-upload/index.ts` — o nome é histórico; publicada
automaticamente ao salvar.

### Observações técnicas

- Extensão do arquivo é forçada para `.jpg` na Edge Function para evitar que um
  nome malicioso termine executável dentro da pasta pública (defesa em profundidade).
- Limite de 5 MB por imagem; a compressão no navegador mantém bem abaixo disso.
- A exclusão de um anexo remove apenas a linha em `os_anexos`; o arquivo em disco
  não é apagado (órfão eventual).