import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const Body = z.object({ query: z.string().trim().min(2).max(200) });
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u, error: ue } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (ue || !u?.user) return json({ error: "Não autenticado" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Descrição inválida" }, 400);

    const lk = Deno.env.get("LOVABLE_API_KEY"), fk = Deno.env.get("FIRECRAWL_API_KEY");
    if (!lk || !fk) return json({ error: "Busca de fotos não configurada" }, 500);

    const r = await fetch(`${GATEWAY}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": fk },
      body: JSON.stringify({ query: parsed.data.query, sources: [{ type: "images" }], limit: 8, country: "BR" }),
    });
    const text = await r.text();
    if (!r.ok) {
      console.error(`Firecrawl [${r.status}]: ${text}`);
      return json({ error: "Falha na busca de fotos", status: r.status, details: text }, r.status);
    }
    const data = JSON.parse(text);
    const imgs: any[] = data?.data?.images || data?.images || [];
    const urls = [...new Set(imgs.map((i) => i.imageUrl || i.url).filter((x: unknown) => typeof x === "string" && x.startsWith("https://")))].slice(0, 6);
    return json({ urls });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
