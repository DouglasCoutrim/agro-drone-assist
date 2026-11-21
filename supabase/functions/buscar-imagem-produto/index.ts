import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({ query: z.string().trim().min(2).max(200) });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT = 8000;

const unicas = (urls: unknown[], limite = 6): string[] =>
  [
    ...new Set(
      urls.filter(
        (u): u is string =>
          typeof u === "string" && /^https:\/\//i.test(u) && !/\.svg($|\?)/i.test(u),
      ),
    ),
  ].slice(0, limite);

// Cache por isolate: a busca em lote repete descrições parecidas.
const cache = new Map<string, { urls: string[]; em: number }>();
const CACHE_MS = 10 * 60 * 1000;

// Depois de um 401 do Firecrawl, não insiste na mesma execução.
let firecrawlDesativado = false;

// 1) Firecrawl (usado quando FIRECRAWL_API_KEY é válida).
async function buscarFirecrawl(key: string, query: string): Promise<string[]> {
  const r = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, sources: [{ type: "images" }], limit: 8, country: "BR" }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const texto = await r.text();
  if (!r.ok) {
    const erro = new Error(`Firecrawl [${r.status}]: ${texto.slice(0, 300)}`);
    if (r.status === 401 || r.status === 403) firecrawlDesativado = true;
    throw erro;
  }
  const data = JSON.parse(texto);
  const imgs: any[] = data?.data?.images || data?.images || [];
  return unicas(imgs.map((i) => i?.imageUrl || i?.url));
}

// 2) Bing Imagens (sem chave) — melhor cobertura de loja brasileira.
async function buscarBing(query: string): Promise<string[]> {
  const r = await fetch(
    `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1&setlang=pt-BR`,
    {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT),
    },
  );
  if (!r.ok) return [];
  const html = await r.text();
  const out: string[] = [];
  // O HTML traz as URLs como murl&quot;:&quot;https://...&quot; (às vezes já decodificado).
  const re = /murl(?:&quot;|")\s*:\s*(?:&quot;|")(https?:\/\/[^&"]+?)(?:&quot;|")/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 12) out.push(m[1]);
  return unicas(out);
}

// 3) DuckDuckGo Imagens (sem chave): pega o token vqd e consulta o endpoint JSON.
async function buscarDuckDuckGo(query: string): Promise<string[]> {
  const pagina = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT) },
  );
  if (!pagina.ok) return [];
  const html = await pagina.text();
  const vqd = html.match(/vqd=["']?([\d-]+)["']?/) || html.match(/vqd=([\d-]+)/);
  if (!vqd) return [];
  const r = await fetch(
    `https://duckduckgo.com/i.js?l=pt-br&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd[1])}&f=,,,&p=1`,
    {
      headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/", Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    },
  );
  if (!r.ok) return [];
  const data = await r.json();
  return unicas((data?.results ?? []).map((x: any) => x?.image));
}

// 4) Openverse (sem chave, JSON estável).
async function buscarOpenverse(query: string): Promise<string[]> {
  const r = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=10`,
    { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT) },
  );
  if (!r.ok) return [];
  const data = await r.json();
  return unicas((data?.results ?? []).map((x: any) => x?.url));
}

// 5) Wikimedia Commons (último recurso, sem chave).
async function buscarWikimedia(query: string): Promise<string[]> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=600" +
    `&gsrsearch=${encodeURIComponent(query)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "agro-drone-assist/1.0 (busca de foto de produto)" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) return [];
  const data = await r.json();
  const pages: Record<string, any> = data?.query?.pages || {};
  return unicas(
    Object.values(pages).map((p) => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url),
  );
}

type Fonte = { nome: string; buscar: (q: string) => Promise<string[]> };

// As duas primeiras cobrem melhor produto de loja; as outras são reserva.
const fontesPrimarias: Fonte[] = [
  { nome: "bing", buscar: buscarBing },
  { nome: "duckduckgo", buscar: buscarDuckDuckGo },
];
const fontesReserva: Fonte[] = [
  { nome: "openverse", buscar: buscarOpenverse },
  { nome: "wikimedia", buscar: buscarWikimedia },
];

// Roda as fontes de cada grupo em paralelo e acumula os resultados.
async function buscarSemChave(query: string, falhas: string[]): Promise<string[]> {
  let urls: string[] = [];
  for (const grupo of [fontesPrimarias, fontesReserva]) {
    if (urls.length >= 4) break;
    const resultados = await Promise.allSettled(grupo.map((f) => f.buscar(query)));
    resultados.forEach((r, i) => {
      if (r.status === "fulfilled") {
        if (r.value.length) urls = unicas([...urls, ...r.value]);
        else falhas.push(grupo[i].nome);
      } else {
        console.error(`[buscar-imagem-produto] fonte ${grupo[i].nome} falhou:`, String(r.reason));
        falhas.push(grupo[i].nome);
      }
    });
  }
  return urls;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error: authError } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
    if (authError || !claims?.claims?.sub) return json({ error: "Não autenticado" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Descrição inválida" }, 400);

    const query = parsed.data.query;
    const chaveCache = query.toLowerCase();
    const emCache = cache.get(chaveCache);
    if (emCache && Date.now() - emCache.em < CACHE_MS) return json({ urls: emCache.urls });

    const falhas: string[] = [];
    let urls: string[] = [];

    const fk = Deno.env.get("FIRECRAWL_API_KEY");
    if (fk && !firecrawlDesativado) {
      try {
        urls = await buscarFirecrawl(fk, query);
      } catch (e) {
        console.error("[buscar-imagem-produto] Firecrawl falhou:", String(e));
        falhas.push("firecrawl");
      }
    }

    if (urls.length < 4) {
      urls = unicas([...urls, ...(await buscarSemChave(query, falhas))]);
    }

    cache.set(chaveCache, { urls, em: Date.now() });
    if (falhas.length) {
      console.warn("[buscar-imagem-produto] fontes sem resultado:", falhas.join(", "));
    }

    const aviso = urls.length
      ? undefined
      : "Nenhuma foto encontrada para esta descrição. Tente encurtar o nome do produto.";

    return json({ urls, ...(aviso ? { aviso } : {}) });
  } catch (e) {
    console.error("[buscar-imagem-produto] erro inesperado:", String(e));
    return json({ error: "Falha na busca de fotos", detalhe: String(e) }, 500);
  }
});
