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
   e faz o upload FTP em modo binário (`TYPE I`), criando as pastas necessárias.
5. A Edge Function grava a URL pública em `public.os_anexos`.

### Estrutura de pastas no FTP

```
public_html/
  uploads/
    {organization_id}/          <- uma pasta por empresa
      {ordem_servico_id}/       <- uma pasta por OS
        {timestamp}_{arquivo}.jpg
```

### Configuração do FTP — tabela `public.ftp_config`

A configuração fica na tabela `public.ftp_config` (linha única, `id = 1`), **lida
pela Edge Function com a service role** (a tabela tem RLS sem policies e acesso
revogado para `anon`/`authenticated`, então o cliente nunca lê a senha).

Colunas: `host`, `port`, `username`, `password`, `base_path`, `public_url`.

Valores atuais (Hostinger):

| Coluna | Valor |
|--------|-------|
| `host` | `ftp.livreos.net` |
| `port` | `21` |
| `username` | `u322252451.livreosimager` |
| `base_path` | `/uploads` |
| `public_url` | `https://livreos.net/uploads` |

> O diretório informado no painel do Hostinger foi
> `/home/u322252451/domains/livreos.net/public_html`. A conta FTP normalmente
> já é "trancada" (chroot) nesse diretório, então `base_path=/uploads` cria
> `public_html/uploads`. Se o upload der erro de caminho/permissão, atualize
> `base_path` para `/home/u322252451/domains/livreos.net/public_html/uploads`
> — a URL pública (`public_url`) continua a mesma.

A Edge Function também aceita variáveis de ambiente (`FTP_HOST`, `FTP_PORT`,
`FTP_USERNAME`, `FTP_PASSWORD`, `FTP_BASE_PATH`, `FTP_PUBLIC_URL`) como fallback
caso a linha em `ftp_config` não exista.

### Deploy

A função está em `supabase/functions/ftp-upload/index.ts` e é publicada
automaticamente ao salvar. Para publicar manualmente:

```bash
supabase functions deploy ftp-upload
```

### Observações técnicas

- Modo passivo (`PASV`) + `TYPE I` (binário) para não corromper imagens.
- Pastas criadas com `MKD` (erros de "já existe" são ignorados).
- Limite de 5 MB por imagem; a compressão no navegador mantém bem abaixo disso.
- A exclusão de um anexo remove apenas a linha em `os_anexos`; o arquivo no FTP
  não é apagado (órfão eventual).
- **Se o ambiente de Edge Functions bloquear conexões TCP de saída para a porta
  21**, o upload falha com erro de conexão. Alternativa garantida: um endpoint
  HTTPS (PHP) na própria hospedagem que grava os arquivos em disco — a Edge
  Function continuaria como gateway autenticado.