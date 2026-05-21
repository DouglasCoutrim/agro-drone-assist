import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FRIENDLY_ERROR = 'Não foi possível extrair dados deste link. Por favor, preencha manualmente.';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  // Always return 200 so the supabase-js client doesn't throw FunctionsHttpError.
  // Errors are signaled via { ok: false, error } in the body.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Try the official ML API first (works without auth for many items)
async function tryOfficialApi(cleanId: string) {
  try {
    const res = await fetch(`https://api.mercadolibre.com/items/${cleanId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;

    // Try to fetch description separately
    let description = '';
    try {
      const descRes = await fetch(`https://api.mercadolibre.com/items/${cleanId}/description`);
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
  } catch {
    return null;
  }
}

// Fallback: scrape the public product page
async function tryScrape(cleanId: string) {
  const numericId = cleanId.replace(/^MLB/i, '');
  // Using the most reliable mobile URL pattern which is often less protected
  const url = `https://produto.mercadolivre.com.br/MLB-${numericId}`;
  
  console.log(`Scraping URL: ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.log(`Scrape failed with status: ${res.status}`);
      return null;
    }
    
    const html = await res.text();

    // Title: look for multiple patterns
    let title = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    if (!title) title = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim();
    if (!title) title = html.match(/"name":\s*"([^"]+)"/)?.[1];

    // Price: try Andes money fraction (most common in modern ML pages)
    let price = 0;
    
    // Pattern 1: andes-money-amount__fraction
    const fractionMatch = html.match(/class="andes-money-amount__fraction">([\d.,]+)</);
    if (fractionMatch) {
      const centsMatch = html.match(/class="andes-money-amount__cents[^>]*>(\d+)</);
      const fraction = fractionMatch[1].replace(/\./g, '').replace(',', '.');
      const cents = centsMatch ? centsMatch[1] : '00';
      price = Number(`${fraction}.${cents}`);
    }

    // Pattern 2: meta price
    if (!price) {
      const priceMeta = html.match(/<meta\s+itemprop=["']price["']\s+content=["']([\d.]+)["']/i)?.[1];
      if (priceMeta) price = Number(priceMeta);
    }

    // Pattern 3: JSON-LD
    if (!price) {
      const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          const offers = Array.isArray(ld) ? ld[0]?.offers : ld?.offers;
          const p = Array.isArray(offers) ? offers[0]?.price : offers?.price;
          if (p) price = Number(p);
        } catch { /* ignore */ }
      }
    }

    // Image: og:image
    const picture_url = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] || '';

    // Description: og:description
    const description = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] || '';

    if (!title) return null;

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
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ ok: false, error: 'Não autorizado' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ ok: false, error: 'Não autorizado' });
    }

    const body = await req.json().catch(() => ({}));
    const rawId = body?.mlId || body?.url || '';
    if (!rawId) {
      return jsonResponse({ ok: false, error: 'ID ou URL do produto é obrigatório' });
    }

    const idMatch = String(rawId).match(/MLB[-]?(\d+)/i);
    const cleanId = idMatch ? `MLB${idMatch[1]}` : String(rawId).replace(/[^A-Za-z0-9]/g, '');

    if (!cleanId || !/^MLB\d+$/i.test(cleanId)) {
      return jsonResponse({ ok: false, error: FRIENDLY_ERROR });
    }

    console.log(`Fetching ML product: ${cleanId}`);

    let result = await tryOfficialApi(cleanId);
    if (!result) {
      console.log(`API failed for ${cleanId}, trying scrape...`);
      result = await tryScrape(cleanId);
    }

    if (!result) {
      return jsonResponse({ ok: false, error: FRIENDLY_ERROR });
    }

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error('ML fetch error:', error);
    return jsonResponse({ ok: false, error: FRIENDLY_ERROR });
  }
});
