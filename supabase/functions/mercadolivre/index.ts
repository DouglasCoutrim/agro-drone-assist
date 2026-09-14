import { serve } from "https://deno.land";
import { createClient } from "https://esm.sh";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FRIENDLY_ERROR = 'Não foi possível extrair dados deste link. Por favor, preencha manualmente.';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Tenta a API oficial do Mercado Livre primeiro
async function tryOfficialApi(cleanId: string) {
  const endpoints = [
    `https://mercadolibre.com{cleanId}`,
  ];
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying API: ${endpoint}`);
      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });
      if (!res.ok) {
        console.log(`API ${endpoint} returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data?.error || !data?.title) continue;

      let description = '';
      try {
        const descRes = await fetch(`${endpoint}/description`);
        if (descRes.ok) {
          const descJson = await descRes.json();
          description = descJson?.plain_text || '';
        }
      } catch { /* ignore */ }

      return {
        title: data.title || '',
        price: Number(data.price) || 0,
        category_id: data.category_id || '',
        thumbnail: data.thumbnail || '',
        picture_url: data.pictures?.[0]?.url || data.thumbnail || '',
        description,
        condition: data.condition || '',
        currency_id: data.currency_id || 'BRL',
        source: 'api',
      };
    } catch (err) {
      console.log(`API request failed ${endpoint}:`, (err as Error).message);
    }
  }
  return null;
}

function decodeHtml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fallback: raspagem da página pública caso a API bloqueie
async function tryScrape(cleanId: string) {
  const numericId = cleanId.replace(/^MLB/i, '');
  const url = `https://mercadolivre.com.br{numericId}`;
  
  console.log(`Scraping URL: ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.log(`Scrape failed with status: ${res.status}`);
      return null;
    }
    
    const html = await res.text();

    if (html.includes('suspicious-traffic-frontend') || html.includes('/gz/account-verification')) {
      console.log('Mercado Livre returned account verification page; scrape blocked.');
      return null;
    }

    let title = '';
    const h1Match = html.match(/<h1[^>]*class=["'][^"']*ui-pdp-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) title = decodeHtml(h1Match[1].replace(/<[^>]*>/g, ''));

    if (!title) {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitle) {
        title = decodeHtml(ogTitle[1].split('|')[0]);
      }
    }

    if (!title) {
      const genericH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (genericH1) title = decodeHtml(genericH1[1].replace(/<[^>]*>/g, ''));
    }

    const lowTitle = title.toLowerCase();
    const blacklist = ['login', 'captcha'];
    if (blacklist.some(b => lowTitle.includes(b)) || title.length < 3) {
      console.log(`Discarding suspicious title: "${title}"`);
      title = '';
    }

    let price = 0;
    const priceMeta = html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([\d.]+)["']/i);
    if (priceMeta) price = Number(priceMeta[1]);

    if (!price) {
      const itemPropPrice = html.match(/<meta[^>]*itemprop=["']price["'][^>]*content=["']([\d.]+)["']/i);
      if (itemPropPrice) price = Number(itemPropPrice[1]);
    }

    if (!price) {
      const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of jsonLdMatches) {
        try {
          const ld = JSON.parse(match[1]);
          const offer = Array.isArray(ld) ? (ld[0]?.offers || ld[1]?.offers) : ld?.offers;
          const p = Array.isArray(offer) ? offer[0]?.price : offer?.price;
          if (p) {
            price = Number(p);
            break;
          }
        } catch { /* ignore */ }
      }
    }

    if (!price) {
      const fractionMatch = html.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([\d.,]+)</);
      if (fractionMatch) {
        const fraction = fractionMatch[1].replace(/\./g, '').replace(',', '.');
        const centsMatch = html.match(/class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>(\d+)</);
        const cents = centsMatch ? centsMatch[1] : '00';
        price = Number(`${fraction}.${cents}`);
      }
    }

    const picture_url = decodeHtml(html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] || '');
    const description = decodeHtml(html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '');

    if (!title) {
       console.log('No title found after all attempts.');
       return null;
    }

    console.log(`Scrape result: Title="${title}", Price=${price}`);

    return {
      title,
      price: price || 0,
      category_id: '',
      thumbnail: picture_url,
      picture_url,
      description,
      condition: '',
      currency_id: 'BRL',
      source: 'scrape',
    };
  } catch (e) {
    console.log(`Scrape error for ${cleanId}:`, (e as Error).message);
    return null;
  }
}

serve(async (req) => {
  // Trata requisições de CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validação de Autenticação Básica do Supabase
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ ok: false, error: 'Não autorizado' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ ok: false, error: 'Sessão expirada' }, 401);
    }

    // 2. CORREÇÃO DO ERRO 400: Leitura segura do corpo para evitar falhas de JSON do Deno
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: 'O corpo da requisição precisa ser um JSON válido contendo a URL.' }, 400);
    }

    const rawId = body?.mlId || body?.url || '';
    if (!rawId) {
      return jsonResponse({ ok: false, error: 'O link ou ID do produto do Mercado Livre é obrigatório.' }, 400);
    }

    // 3. Extração e Higienização do ID MLB
    const idMatch = String(rawId).match(/MLB[-]?(\d+)/i);
    const cleanId = idMatch ? `MLB${idMatch[1]}` : String(rawId).replace(/[^A-Za-z0-9]/g, '');

    if (!cleanId || !/^MLB\d+$/i.test(cleanId)) {
      return jsonResponse({ ok: false, error: 'Formato de link inválido. Certifique-se de usar uma URL correta do Mercado Livre.' }, 400);
    }

    console.log(`Processing ML request: ${cleanId}`);

    // 4. Execução sequencial: Tenta API e se falhar vai para o Scrape
    let result = await tryOfficialApi(cleanId);
    if (!result) {
      console.log(`API failed for ${cleanId}, falling back to scrape...`);
      result = await tryScrape(cleanId);
    }

    // Retorna erro estruturado caso ambos os métodos falhem
    if (!result) {
      return jsonResponse({ ok: false, error: FRIENDLY_ERROR }, 422);
    }

    // Retorno de sucesso mapeado para o estoque da oficina
    return jsonResponse({ ok: true, ...result });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return jsonResponse({ ok: false, error: 'Erro interno ao processar requisição no servidor' }, 500);
  }
});
