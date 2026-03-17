import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mlId } = await req.json();
    if (!mlId) {
      return new Response(JSON.stringify({ error: 'ID do produto é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize the ID
    const cleanId = String(mlId).replace(/[^A-Za-z0-9]/g, '');
    
    console.log(`Fetching ML product: ${cleanId}`);

    const res = await fetch(`https://api.mercadolibre.com/items/${cleanId}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      return new Response(JSON.stringify({ error: 'Produto não encontrado no Mercado Livre' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return only needed fields
    const result = {
      title: data.title || '',
      price: data.price || 0,
      category_id: data.category_id || '',
      thumbnail: data.thumbnail || '',
      picture_url: data.pictures?.[0]?.url || data.thumbnail || '',
      condition: data.condition || '',
      currency_id: data.currency_id || 'BRL',
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('ML fetch error:', error);
    return new Response(JSON.stringify({ error: 'Erro ao buscar produto' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
