import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ erro: "Não autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return jsonResponse({ erro: "Sessão expirada" }, 401);

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return jsonResponse({ erro: "Usuário sem organização vinculada" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const url = body?.url || body?.mlId;
    const margem = Number(body?.margem ?? 30);
    const quantidade = Number(body?.quantidade ?? 1);
    const estoqueMinimo = Number(body?.estoque_minimo ?? 1);

    if (!url) return jsonResponse({ erro: "Nenhum link fornecido." }, 400);

    const regex = /MLB[-_]?\d+/i;
    const match = String(url).match(regex);
    if (!match) {
      return jsonResponse({
        erro: "Link inválido. O link precisa conter o ID do produto (ex: MLB123456...).",
      }, 400);
    }
    const itemId = match[0].replace(/[-_]/g, "").toUpperCase();

    // Fetch official ML API
    const mlRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        Accept: "application/json",
      },
    });
    const mlData = await mlRes.json();
    if (mlData.error || !mlData.title) {
      return jsonResponse({
        erro: `Erro no Mercado Livre: ${mlData.message || "produto não encontrado"}`,
      }, 400);
    }

    const custo = Number(mlData.price) || 0;
    const precoVenda = Number((custo * (1 + margem / 100)).toFixed(2));

    // Generate codigo (avoid collision with unique constraint)
    let codigo = `ML-${itemId}`;
    const { data: existing } = await supabase
      .from("itens_estoque")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (existing) codigo = `ML-${itemId}-${Date.now().toString().slice(-4)}`;

    const novoProduto = {
      organization_id: profile.organization_id,
      codigo,
      descricao: String(mlData.title).slice(0, 255),
      categoria: mlData.category_id || "Mercado Livre",
      custo_unitario: custo,
      preco_venda: precoVenda,
      quantidade,
      estoque_minimo: estoqueMinimo,
      fornecedor: "Mercado Livre",
      localizacao: mlData.permalink || null,
    };

    const { data, error } = await supabase
      .from("itens_estoque")
      .insert(novoProduto)
      .select()
      .single();

    if (error) {
      return jsonResponse({ erro: error.message }, 400);
    }

    return jsonResponse({ sucesso: true, produto: data });
  } catch (error) {
    return jsonResponse({ erro: (error as Error).message || "Erro interno" }, 500);
  }
});
