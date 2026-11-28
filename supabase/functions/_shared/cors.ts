/**
 * CORS das Edge Functions.
 *
 * O navegador aceita apenas UMA origem no cabeçalho Access-Control-Allow-Origin,
 * e o mesmo código é servido em várias origens: produção (https://livreos.net),
 * previews do editor e futuros domínios próprios. Como o cabeçalho é estático
 * (avaliado no import do módulo, sem acesso à requisição), a única forma de
 * atender todas as origens é `*`.
 *
 * Isso não abre dados: a fronteira de segurança destas funções é o JWT do
 * usuário (Authorization), verificado dentro de cada função — CORS não é
 * autenticação. Requisições com cookie/credencial não são usadas aqui, então
 * `*` é compatível. Sintoma quando a origem não casa: o navegador bloqueia o
 * preflight e o front mostra "Failed to fetch" sem mensagem do servidor.
 *
 * ALLOWED_ORIGIN continua exportado porque 8 funções montam o próprio
 * corsHeaders com ele; assim todas seguem o mesmo valor.
 */
export const ALLOWED_ORIGIN = '*';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
