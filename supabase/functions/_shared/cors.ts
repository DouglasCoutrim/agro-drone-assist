/**
 * CORS das Edge Functions.
 *
 * Origem única, lida do segredo ALLOWED_ORIGIN (padrão https://livreos.net).
 * O navegador aceita apenas uma origem no cabeçalho Access-Control-Allow-Origin,
 * então usamos a primeira da lista. ALLOWED_ORIGIN aceita várias separadas por
 * vírgula para deixar o valor pronto caso passemos a devolver a origem que
 * combinou com o cabeçalho Origin da requisição.
 */
const PADRAO = 'https://livreos.net';

export const ORIGENS_PERMITIDAS: string[] = (Deno.env.get('ALLOWED_ORIGIN') ?? PADRAO)
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

export const ALLOWED_ORIGIN: string = ORIGENS_PERMITIDAS[0] ?? PADRAO;

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
