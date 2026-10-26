import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BHyDeh3HfJeKFvT1CqafdShtZotAJl88o6rSG2U-jn8TGAd02j0TVeSuubtmvHyXot-y8SjvK13rFrmIaq7ho0o";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const inIframe = () => { try { return window.self !== window.top; } catch { return true; } };

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getRegistration() {
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/push/" });
}

export async function getPushStatus(): Promise<"unsupported" | "iframe" | "denied" | "on" | "off"> {
  if (!pushSupported()) return "unsupported";
  if (inIframe()) return "iframe";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/push/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(userId: string) {
  if (!pushSupported()) throw new Error("Este aparelho não suporta notificações. No iPhone, instale o app na tela de início primeiro.");
  if (inIframe()) throw new Error("Abra o sistema em uma aba própria (ou pelo app instalado) para ativar.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permissão de notificação negada.");
  const reg = await getRegistration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration("/push/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
