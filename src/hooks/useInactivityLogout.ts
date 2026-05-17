import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos
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
      const elapsed = Date.now() - lastActivity;
      const untilWarn = Math.max(INACTIVITY_MS - WARNING_MS - elapsed, 0);
      const untilLogout = Math.max(INACTIVITY_MS - elapsed, 0);

      warnTimer.current = window.setTimeout(() => {
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.warning("Sua sessão expirará em 1 minuto por inatividade.");
        }
      }, untilWarn);

      logoutTimer.current = window.setTimeout(async () => {
        await signOut();
        toast.error("Sessão encerrada por inatividade.");
        navigate("/auth");
      }, untilLogout);
    };

    const reset = () => {
      const now = Date.now();
      // throttle: só persiste a cada 5s para evitar flood
      if (now - throttleRef.current < 5000) return;
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

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
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
      window.removeEventListener("storage", onStorage);
    };
  }, [user, signOut, navigate]);
}
