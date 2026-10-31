# Assinatura simples na tela (no lugar do gov.br)

A integração com o gov.br não é possível: o acesso só é liberado para órgãos públicos em endereço oficial do governo. Este plano usa assinatura desenhada na tela, com registro de data e hora.

## O que o usuário vai ver
1. **Minha assinatura (Configurações)**: cada usuário desenha a própria assinatura uma vez (dedo no celular ou mouse) e salva. Dá para refazer quando quiser.
2. **Assinar antes de gerar o PDF**: ao gerar o PDF de OS, orçamento (inclusive o agrupado) ou nota de retirada para demonstração, abre uma janela de assinatura:
   - **Responsável da empresa**: aplica a assinatura salva com um clique (ou desenha na hora).
   - **Cliente / funcionário**: desenha na tela, no próprio aparelho (opcional, dá para pular e assinar no papel).
3. **No PDF**: a imagem da assinatura entra sobre a linha de assinatura, com nome, data/hora e um código de verificação curto embaixo.
4. Sem assinatura, o PDF continua saindo como hoje, com a linha em branco.

## Segurança e registro
- As assinaturas ficam guardadas no armazenamento da empresa, visíveis só para quem é da mesma empresa.
- Cada assinatura aplicada fica registrada (quem assinou, qual documento, data/hora, aparelho) para consulta futura.

## Detalhes técnicos
- Componente `SignaturePad` (canvas nativo com pointer events, sem biblioteca nova), exporta PNG.
- Bucket privado `assinaturas` com pastas por `organization_id`; leitura/gravação por RLS da organização; usuário só grava a própria assinatura padrão.
- Coluna `assinatura_url` em `profiles`; tabela `assinaturas_documentos` (organization_id, tipo_documento, documento_id, papel, nome, assinado_por, imagem_path, hash SHA-256, user_agent, created_at) com RLS por organização.
- `SignDocumentDialog` compartilhado, chamado antes de `OSPDFGenerator`, `orcamento-consolidado-pdf` e do PDF de `Demonstracoes`; os geradores recebem as imagens opcionais e as desenham sobre as linhas existentes.
- Regra no AGENTS.md: assinaturas são imagens com registro de auditoria, não assinatura ICP/gov.br.
