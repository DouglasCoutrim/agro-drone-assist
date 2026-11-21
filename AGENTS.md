# AGENTS.md — Projeto agro-drone-assist

## Armazenamento de imagens das OS via FTP (Hostinger)

As fotos anexadas nas ordens de serviço são enviadas por **FTP** para a hospedagem
do sistema (`livreos.net`), não ficam em bucket do Supabase nem em base64 no banco.
No banco (`os_anexos`) é gravado apenas o registro + a **URL pública** da imagem.

### Fluxo

1. Técnico clica em "Anexar Imagens" na OS → câmera do celular abre.
2. A imagem é comprimida no navegador (máx. 1200px, JPEG qualidade 0.7).
3. O navegador envia a imagem para a Edge Function `ftp-upload`
   (via `fetch` com `FormData`, já que `supabase.functions.invoke` não envia multipart).
4. A Edge Function autentica o usuário pelo JWT, descobre a `organization_id`
   do perfil e faz o upload FTP em modo binário (`TYPE I`).
5. A Edge Function grava a URL pública em `public.os_anexos`.

### Estrutura de pastas no FTP

```
public_html/
  uploads/
    {organization_id}/          <- uma pasta por empresa
      {ordem_servico_id}/       <- uma pasta por OS
        {timestamp}_{arquivo}.jpg
```

### Credenciais do FTP (ir em Supabase → Edge Functions → Secrets)

Estes valores **não** ficam no código; são lidos da função via `Deno.env.get`.
Configure em *Supabase Dashboard → Project Settings → Edge Functions → Secrets*:

| Variável | Valor |
|----------|-------|
| `FTP_HOST` | `ftp.livreos.net` |
| `FTP_PORT` | `21` |
| `FTP_USERNAME` | `u322252451.livreosimager` |
| `FTP_PASSWORD` | *(a senha do FTP — definir no painel, nunca no código)* |
| `FTP_BASE_PATH` | `/uploads` |
| `FTP_PUBLIC_URL` | `https://livreos.net/uploads` |

> O diretório informado no painel do Hostinger foi
> `/home/u322252451/domains/livreos.net/public_html`. A conta FTP normalmente
> já é "trancada" (chroot) nesse diretório, então `FTP_BASE_PATH=/uploads`
> cria `public_html/uploads`. Se o login **não** for chroot e o upload falhar,
> use `FTP_BASE_PATH=/domains/livreos.net/public_html/uploads`.

### Deploy

A função está em `supabase/functions/ftp-upload/index.ts`. É publicada
automaticamente ao salvar. Para publicar manualmente:

```bash
supabase functions deploy ftp-upload
```

### Observações técnicas

- Modo passivo (`PASV`) + `TYPE I` (binário) para não corromper imagens.
- Pastas criadas com `MKD` (erros de "já existe" são ignorados).
- Limite de 5 MB por imagem; a compressão no navegador mantém bem abaixo disso.
- **Se o ambiente de Edge Functions bloquear conexões TCP de saída para a porta
  21**, o upload falha com erro de conexão. Alternativa garantida: trocar o
  destino para um endpoint HTTPS (PHP) na própria hospedagem, que grava os
  arquivos em disco — a Edge Function continuaria como gateway autenticado.