import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutos
const WARNING_MS = 60 * 1000; // aviso 1 min antes
const STORAGE_KEY = "livreos:lastActivityAt";

export function useInactivityLogout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const warnTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const warnedRef = useRef(false);
  const throttleRef = useRef(0);
  const signOutRef = useRef(signOut);
  const navigateRef = useRef(navigate);
  signOutRef.current = signOut;
  navigateRef.current = navigate;

  useEffect(() => {
    if (!user) return;

    const clearTimers = () => {
      if (warnTimer.current) window.clearTimeout(warnTimer.current);
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
    };

    const expire = async () => {
      clearTimers();
      try { await signOutRef.current(); } catch {}
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      toast.info("Sua sessão expirou por inatividade. Faça login novamente.");
      navigateRef.current("/auth?expired=1", { replace: true });
    };

    const readStored = () => {
      try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v ? parseInt(v, 10) : NaN;
      } catch {
        return NaN;
      }
    };

    const scheduleFrom = (lastActivity: number) => {
      clearTimers();
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= INACTIVITY_MS) {
        void expire();
        return;
      }
      const untilWarn = Math.max(INACTIVITY_MS - WARNING_MS - elapsed, 0);
      const untilLogout = INACTIVITY_MS - elapsed;

      warnTimer.current = window.setTimeout(() => {
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.warning("Sua sessão expirará em 1 minuto por inatividade.");
        }
      }, untilWarn);

      logoutTimer.current = window.setTimeout(() => { void expire(); }, untilLogout);
    };

    const reset = () => {
      const now = Date.now();
      // Ao voltar ao app (celular/aba em segundo plano), verifica expiração antes de renovar
      const last = readStored();
      if (!Number.isNaN(last) && now - last >= INACTIVITY_MS) {
        void expire();
        return;
      }
      if (now - throttleRef.current < 5000) {
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

    // Sem registro de atividade = sessão antiga sem controle: encerra por segurança
    const stored = readStored();
    if (Number.isNaN(stored)) {
      void expire();
    } else {
      scheduleFrom(stored);
    }

    return () => {
      clearTimers();
      events.forEach((ev) => window.removeEventListener(ev, reset));
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("storage", onStorage);
    };
  }, [user]);
}
