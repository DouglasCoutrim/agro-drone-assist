import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

webpush.setVapidDetails(
  "mailto:contato@livreos.net",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { notification_id } = await req.json();
    if (typeof notification_id !== "string") return new Response("bad request", { status: 400, headers: cors });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: n } = await admin.from("notifications")
      .select("id,user_id,title,body,link,created_at").eq("id", notification_id).maybeSingle();
    // Só envia notificações recém-criadas (evita reenvio por chamadas externas)
    if (!n || Date.now() - new Date(n.created_at).getTime() > 2 * 60_000) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", n.user_id);
    const payload = JSON.stringify({ title: n.title, body: n.body ?? "", link: n.link ?? "/notificacoes", tag: n.id });
    let sent = 0;
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push error", e?.statusCode, e?.body);
      }
    }));
    return new Response(JSON.stringify({ sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
