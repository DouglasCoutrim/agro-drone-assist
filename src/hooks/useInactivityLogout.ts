import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const INACTIVITY_MS = 60 * 60 * 1000; // 60 minutos (aumentado de 10)
const WARNING_MS = 60 * 1000; // aviso 1 min antes
const STORAGE_KEY = "livreos:lastActivityAt";

export function useInactivityLogout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const warnTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const warnedRef = useRef(false);
  const throttleRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    const clearTimers = () => {
      if (warnTimer.current) window.clearTimeout(warnTimer.current);
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
    };

    const scheduleFrom = (lastActivity: number) => {
      clearTimers();
      const now = Date.now();
      const elapsed = now - lastActivity;
      
      // Se o tempo decorrido já é maior que o limite, não desloga imediatamente no login
      // Apenas se a atividade foi gravada há muito tempo atrás e o usuário acabou de carregar a página
      const untilWarn = Math.max(INACTIVITY_MS - WARNING_MS - elapsed, 0);
      const untilLogout = Math.max(INACTIVITY_MS - elapsed, 0);

      if (elapsed >= INACTIVITY_MS) {
        // Se já passou do tempo, vamos resetar o timer em vez de deslogar imediatamente
        // para evitar loops de logout logo após o login se o localStorage estiver sujo
        reset();
        return;
      }

      warnTimer.current = window.setTimeout(() => {
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.warning("Sua sessão expirará em 1 minuto por inatividade.");
        }
      }, untilWarn);

      logoutTimer.current = window.setTimeout(async () => {
        try { await signOut(); } catch {}
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        navigate("/auth?expired=1", { replace: true });
      }, untilLogout);
    };

    const reset = () => {
      const now = Date.now();
      // throttle: só persiste a cada 5s para evitar flood
      if (now - throttleRef.current < 5000) {
        // Mesmo no throttle, se houver atividade real, limpamos o aviso
        warnedRef.current = false;
        return;
      }
      throttleRef.current = now;
      warnedRef.current = false;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {}
      scheduleFrom(now);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const ts = parseInt(e.newValue, 10);
      if (!Number.isNaN(ts)) {
        warnedRef.current = false;
        scheduleFrom(ts);
      }
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ] as const;
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("storage", onStorage);

    // inicializa a partir do último timestamp (cross-tab) ou agora
    const stored = (() => {
      try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v ? parseInt(v, 10) : NaN;
      } catch {
        return NaN;
      }
    })();
    const start = !Number.isNaN(stored) ? stored : Date.now();
    if (Number.isNaN(stored)) {
      try {
        localStorage.setItem(STORAGE_KEY, String(start));
      } catch {}
    }
    scheduleFrom(start);

    return () => {
      clearTimers();
      events.forEach((ev) => window.removeEventListener(ev, reset));
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("storage", onStorage);
    };
  }, [user, signOut, navigate]);
}
