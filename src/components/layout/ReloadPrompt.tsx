import { useEffect, useRef } from "react";
// @ts-ignore: virtual module from vite-plugin-pwa
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }
  if (new URLSearchParams(window.location.search).get("sw") === "off") {
    return true;
  }
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (url.endsWith(SW_URL)) await r.unregister();
    }
  } catch {}
}

export function ReloadPrompt() {
  const promptedRef = useRef(false);

  useEffect(() => {
    if (isRefusedContext()) {
      void unregisterMatching();
      return;
    }
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (promptedRef.current) return;
        promptedRef.current = true;
        // Manual prompt — never auto-reloads or interrupts user work.
        toast("Nova versão disponível", {
          description: "Atualize quando terminar o que está fazendo.",
          duration: Infinity,
          action: {
            label: "Atualizar agora",
            onClick: () => updateSW(true),
          },
        });
      },
      onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
        if (!registration) return;
        // Check for updates every 6h (no auto-apply).
        setInterval(() => registration.update().catch(() => {}), 6 * 60 * 60 * 1000);
      },
    });
  }, []);

  return null;
}
