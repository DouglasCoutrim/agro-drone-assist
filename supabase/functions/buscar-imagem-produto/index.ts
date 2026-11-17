import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({ query: z.string().trim().min(2).max(200) });
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const unicas = (urls: unknown[]) =>
  [...new Set(urls.filter((u): u is string => typeof u === "string" && u.startsWith("https://")))].slice(0, 6);

// Busca de imagens no Firecrawl (API direta, sem gateway intermediário).
async function buscarFirecrawl(key: string, query: string): Promise<string[]> {
  const r = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, sources: [{ type: "images" }], limit: 8, country: "BR" }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Firecrawl [${r.status}]: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const imgs: any[] = data?.data?.images || data?.images || [];
  return unicas(imgs.map((i) => i?.imageUrl || i?.url));
}

// Reserva sem credencial: Wikimedia Commons (funciona mesmo sem FIRECRAWL_API_KEY).
async function buscarWikimedia(query: string): Promise<string[]> {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=600" +
    `&gsrsearch=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { "User-Agent": "agro-drone-assist/1.0 (busca de foto de produto)" } });
  if (!r.ok) return [];
  const data = await r.json();
  const pages: Record<string, any> = data?.query?.pages || {};
  return unicas(Object.values(pages).map((p) => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims?.sub) return json({ error: "Não autenticado" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Descrição inválida" }, 400);

    const query = parsed.data.query;
    const fk = Deno.env.get("FIRECRAWL_API_KEY");
    let urls: string[] = [];
    let aviso: string | undefined;

    if (fk) {
      try {
        urls = await buscarFirecrawl(fk, query);
      } catch (e) {
        // Chave inválida/sem créditos: registra e tenta a reserva em vez de derrubar a busca.
        console.error("[buscar-imagem-produto] Firecrawl falhou:", String(e));
        aviso = "Busca de imagens indisponível; exibindo resultados alternativos.";
      }
    } else {
      aviso = "Busca de imagens não configurada; exibindo resultados alternativos.";
    }

    if (!urls.length) urls = await buscarWikimedia(query);

    return json({ urls, ...(aviso ? { aviso } : {}) });
  } catch (e) {
    console.error("[buscar-imagem-produto] erro inesperado:", String(e));
    return json({ error: "Falha na busca de fotos", detalhe: String(e) }, 500);
  }
});
