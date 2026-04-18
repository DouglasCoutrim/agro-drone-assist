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
  // Build canonical URL: MLB-2068438699
  const numericId = cleanId.replace(/^MLB/i, '');
  const candidates = [
    `https://produto.mercadolivre.com.br/MLB-${numericId}`,
    `https://www.mercadolivre.com.br/p/${cleanId}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Title: og:title or <h1>
      const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
      const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim();
      const title = ogTitle || h1 || '';

      // Price: try JSON-LD or meta
      let price = 0;
      const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          const offers = Array.isArray(ld) ? ld[0]?.offers : ld?.offers;
          const p = Array.isArray(offers) ? offers[0]?.price : offers?.price;
          if (p) price = Number(p);
        } catch { /* ignore */ }
      }
      if (!price) {
        const priceMeta = html.match(/<meta\s+itemprop=["']price["']\s+content=["']([\d.]+)["']/i)?.[1];
        if (priceMeta) price = Number(priceMeta);
      }
      if (!price) {
        // Andes price fraction
        const fraction = html.match(/"andes-money-amount__fraction"[^>]*>([\d.]+)</)?.[1]?.replace(/\./g, '');
        const cents = html.match(/"andes-money-amount__cents"[^>]*>(\d+)</)?.[1] || '00';
        if (fraction) price = Number(`${fraction}.${cents}`);
      }

      // Image: og:image
      const picture_url = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] || '';

      // Description: og:description
      const description = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] || '';

      if (!title) continue;

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
    } catch {
      continue;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const rawId = body?.mlId || body?.url || '';
    if (!rawId) {
      return jsonResponse({ error: 'ID ou URL do produto é obrigatório' }, 400);
    }

    // Extract ID from URL or string
    const idMatch = String(rawId).match(/MLB[-]?(\d+)/i);
    const cleanId = idMatch ? `MLB${idMatch[1]}` : String(rawId).replace(/[^A-Za-z0-9]/g, '');

    if (!cleanId || !/^MLB\d+$/i.test(cleanId)) {
      return jsonResponse({ error: FRIENDLY_ERROR }, 400);
    }

    console.log(`Fetching ML product: ${cleanId}`);

    // Try official API first, then fallback to scrape
    let result = await tryOfficialApi(cleanId);
    if (!result) {
      console.log(`API failed for ${cleanId}, trying scrape...`);
      result = await tryScrape(cleanId);
    }

    if (!result) {
      return jsonResponse({ error: FRIENDLY_ERROR }, 404);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('ML fetch error:', error);
    return jsonResponse({ error: FRIENDLY_ERROR }, 500);
  }
});
