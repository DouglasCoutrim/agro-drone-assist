# Substituir os arquivos pelo conteúdo do ZIP

## Arquivos mapeados

- `index.ts` → `supabase/functions/create-customer-charge/index.ts`
- `mnt/user-data/outputs/fixes/supabase/functions/asaas-customer-sync/index.ts` → `supabase/functions/asaas-customer-sync/index.ts`
- `mnt/user-data/outputs/fixes/supabase/functions/asaas-tenant-webhook/index.ts` → `supabase/functions/asaas-tenant-webhook/index.ts`
- `mnt/user-data/outputs/fixes/supabase/functions/mercadopago-webhook/index.ts` → `supabase/functions/mercadopago-webhook/index.ts`
- `OrdensServico.tsx` → `src/pages/OrdensServico.tsx`

## Implementação

1. Extrair o ZIP somente em uma pasta temporária e substituir os cinco arquivos correspondentes no projeto.
2. Preservar os caminhos e nomes atuais do projeto; os diretórios extras existentes dentro do ZIP não serão copiados.
3. Publicar novamente as quatro funções alteradas para que as correções do arquivo entrem em funcionamento.
4. Verificar a compilação, os erros de execução e o fluxo principal de Ordens de Serviço e cobranças.

## Resultado esperado

- A permissão de cobrança e sincronização será consultada pelo papel real do usuário.
- As referências de pagamento passarão a usar o identificador correto da OS.
- Os webhooks evitarão referências inválidas e atualizarão a OS para `entregue` após pagamento aprovado.
- Nenhum outro arquivo do projeto será alterado.
