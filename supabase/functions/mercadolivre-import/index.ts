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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return jsonResponse({ erro: "Usuário sem organização vinculada" }, 400);
    }

    // 1. O corpo da requisição deve conter a propriedade "url"
    const body = await req.json().catch(() => ({}));
    const url = String(body?.url ?? "").trim();
    const margem = Number(body?.margem ?? 30);
    const quantidade = Number(body?.quantidade ?? 1);
    const estoqueMinimo = Number(body?.estoque_minimo ?? 1);

    if (!url) return jsonResponse({ erro: "URL ausente" }, 400);

    // 2. Extrai o código MLB usando Regex
    const match = url.match(/(MLB-?\d+)/i);
    if (!match) {
      return jsonResponse({ erro: "ID MLB não encontrado na URL" }, 400);
    }
    const mlbId = match[1].replace("-", "").toUpperCase();

    // 3. Consulta direta na API pública do Mercado Livre (sem scraping)
    const mlRes = await fetch(`https://api.mercadolibre.com/items/${mlbId}`, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!mlRes.ok) {
      const text = await mlRes.text().catch(() => "");
      return jsonResponse({
        erro: "Erro ao buscar no Mercado Livre",
        status_api: mlRes.status,
        detalhe: text.slice(0, 300),
      }, 400);
    }
    const data = await mlRes.json();
    if (!data?.title) {
      return jsonResponse({ erro: "Produto não encontrado no Mercado Livre" }, 400);
    }

    const custo = Number(data.price) || 0;
    const precoVenda = Number((custo * (1 + margem / 100)).toFixed(2));

    // 4. Gera código evitando colisão com a constraint única
    let codigo = `ML-${mlbId}`;
    const { data: existing } = await supabase
      .from("itens_estoque")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("codigo", codigo)
      .maybeSingle();
    if (existing) codigo = `ML-${mlbId}-${Date.now().toString().slice(-4)}`;

    const novoProduto = {
      organization_id: profile.organization_id,
      codigo,
      descricao: String(data.title).slice(0, 255),
      categoria: data.category_id || "Mercado Livre",
      custo_unitario: custo,
      preco_venda: precoVenda,
      quantidade,
      estoque_minimo: estoqueMinimo,
      fornecedor: "Mercado Livre",
      localizacao: data.permalink || null,
    };

    let { data: produto, error } = await supabase
      .from("itens_estoque")
      .insert(novoProduto)
      .select()
      .single();

    if (error?.code === "23505") {
      codigo = `ML-${mlbId}-${crypto.randomUUID().slice(0, 8)}`;
      const retry = await supabase
        .from("itens_estoque")
        .insert({ ...novoProduto, codigo })
        .select()
        .single();
      produto = retry.data;
      error = retry.error;
    }

    if (error) {
      return jsonResponse({ erro: error.message }, 400);
    }

    return jsonResponse({ sucesso: true, produto });
  } catch (error) {
    return jsonResponse({ erro: (error as Error).message || "Erro interno" }, 400);
  }
});