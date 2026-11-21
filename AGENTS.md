# AGENTS.md — Projeto agro-drone-assist

## Armazenamento de imagens das OS na hospedagem (via HTTPS/PHP)

As fotos anexadas nas ordens de serviço são gravadas na **hospedagem** (`livreos.net`),
em uma pasta por empresa, e **não** ficam em bucket do Supabase nem em base64 no banco.
No banco (`os_anexos`) é gravado apenas o registro + a **URL pública** da imagem.

> **Por que não FTP:** funções serverless (Supabase Edge Functions) não têm TCP de
> saída liberado para FTP (porta 21) — tentativas retornam erro 500. Por isso o
> caminho principal é HTTPS para um script PHP na própria hospedagem. O FTP
> continua implementado como fallback caso a linha de config não tenha HTTP.

### Fluxo

1. Técnico clica em "Anexar Imagens" na OS → câmera do celular abre.
2. A imagem é comprimida no navegador (máx. 1200px, JPEG qualidade 0.7).
3. O navegador envia a imagem para a Edge Function `ftp-upload` via `fetch` (multipart).
4. A Edge Function autentica o JWT, obtém a `organization_id` do perfil e envia
   a imagem por **HTTPS** para `https://livreos.net/upload-os-image.php` com o
   header `X-Upload-Secret`.
5. O script PHP grava em `public_html/uploads/{org}/{os}/{arquivo}.jpg` e devolve a URL.
6. A Edge Function grava a URL pública em `public.os_anexos`.

### Estrutura de pastas na hospedagem

```
public_html/
  upload-os-image.php          <- script que recebe a imagem
  uploads/
    {organization_id}/          <- uma pasta por empresa
      {ordem_servico_id}/       <- uma pasta por OS
        {timestamp}_{arquivo}.jpg
```

O script PHP versionado fica em `hosting/upload-os-image.php` (copiar para a raiz
do site). Ele valida o segredo, confere que o arquivo é imagem, restringe a
extensão a jpg/jpeg/png/webp e grava com `move_uploaded_file`.

### Configuração — tabela `public.ftp_config` (linha `id = 1`)

Lida pela Edge Function com a service role. RLS ativa sem policies e acesso
revogado para `anon`/`authenticated` — o cliente nunca lê os segredos.

| Coluna | Valor atual |
|--------|-------------|
| `http_upload_url` | `https://livreos.net/upload-os-image.php` |
| `http_upload_secret` | *(igual ao `$SECRET` do PHP)* |
| `host` | `ftp.livreos.net` (fallback) |
| `port` | `21` |
| `username` | `u322252451.livreosimager` |
| `base_path` | `/uploads` |
| `public_url` | `https://livreos.net/uploads` |

A Edge Function também aceita variáveis de ambiente como fallback
(`HTTP_UPLOAD_URL`, `HTTP_UPLOAD_SECRET`, `FTP_*`).

### Deploy

Função em `supabase/functions/ftp-upload/index.ts` (publicada automaticamente ao salvar).

### Observações técnicas

- Extensão do arquivo é forçada para `.jpg` na Edge Function para evitar que um
  nome malicioso termine executável dentro da pasta pública (defesa em profundidade).
- Limite de 5 MB por imagem; a compressão no navegador mantém bem abaixo disso.
- A exclusão de um anexo remove apenas a linha em `os_anexos`; o arquivo em disco
  não é apagado (órfão eventual).