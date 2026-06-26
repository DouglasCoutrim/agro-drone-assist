import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FRIENDLY_ERROR = 'Não foi possível extrair dados deste link. Por favor, preencha manualmente.';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Try the official ML API first (tries .com and .com.br mirrors with rich headers)
async function tryOfficialApi(cleanId: string) {
  const endpoints = [
    `https://api.mercadolibre.com/items/${cleanId}`,
    `https://api.mercadolivre.com/items/${cleanId}`,
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
      console.error(`API error ${endpoint}:`, (err as Error).message);
    }
  }
  return null;
}

// Fallback: scrape the public product page
async function tryScrape(cleanId: string) {
  const numericId = cleanId.replace(/^MLB/i, '');
  const url = `https://produto.mercadolivre.com.br/MLB-${numericId}`;
  
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

    // 1. Title Extraction (Specific Order)
    let title = '';
    
    // Pattern A: h1 with class ui-pdp-title
    const h1Match = html.match(/<h1[^>]*class=["'][^"']*ui-pdp-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) title = h1Match[1].replace(/<[^>]*>/g, '').trim();

    // Pattern B: meta og:title
    if (!title) {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitle) {
        // ML often puts site name in og:title, e.g. "Product Name | Mercado Livre"
        title = ogTitle[1].split('|')[0].trim();
      }
    }

    // Pattern C: any h1
    if (!title) {
      const genericH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (genericH1) title = genericH1[1].replace(/<[^>]*>/g, '').trim();
    }

    // Filter out metadata titles often found in scrape
    const lowTitle = title.toLowerCase();
    const blacklist = ['login', 'captcha'];
    if (blacklist.some(b => lowTitle.includes(b)) || title.length < 3) {
      console.log(`Discarding suspicious title: "${title}"`);
      title = '';
    }

    // 2. Price Extraction
    let price = 0;
    
    // Pattern A: meta product:price:amount
    const priceMeta = html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([\d.]+)["']/i);
    if (priceMeta) price = Number(priceMeta[1]);

    // Pattern B: meta itemprop="price"
    if (!price) {
      const itemPropPrice = html.match(/<meta[^>]*itemprop=["']price["'][^>]*content=["']([\d.]+)["']/i);
      if (itemPropPrice) price = Number(itemPropPrice[1]);
    }

    // Pattern C: JSON-LD
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

    // Pattern D: DOM Scraping (Andes Money)
    if (!price) {
      const fractionMatch = html.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([\d.,]+)</);
      if (fractionMatch) {
        const fraction = fractionMatch[1].replace(/\./g, '').replace(',', '.');
        const centsMatch = html.match(/class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>(\d+)</);
        const cents = centsMatch ? centsMatch[1] : '00';
        price = Number(`${fraction}.${cents}`);
      }
    }

    // 3. Image & Category
    const picture_url = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
    
    // Description (often meta)
    const description = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';

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
    console.error(`Scrape error for ${cleanId}:`, e.message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body = await req.json().catch(() => ({}));
    const rawId = body?.mlId || body?.url || '';
    if (!rawId) {
      return jsonResponse({ ok: false, error: 'ID ou URL do produto é obrigatório' });
    }

    const idMatch = String(rawId).match(/MLB[-]?(\d+)/i);
    const cleanId = idMatch ? `MLB${idMatch[1]}` : String(rawId).replace(/[^A-Za-z0-9]/g, '');

    if (!cleanId || !/^MLB\d+$/i.test(cleanId)) {
      return jsonResponse({ ok: false, error: 'Formato de ID inválido. Use MLB... ou o link do produto.' });
    }

    console.log(`Processing ML request: ${cleanId}`);

    let result = await tryOfficialApi(cleanId);
    if (!result) {
      console.log(`API failed for ${cleanId}, falling back to scrape...`);
      result = await tryScrape(cleanId);
    }

    if (!result) {
      return jsonResponse({ ok: false, error: FRIENDLY_ERROR });
    }

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error('Edge Function Error:', error);
    return jsonResponse({ ok: false, error: 'Erro interno ao processar requisição' });
  }
});