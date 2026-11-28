import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Joyride, type EventData, type Step } from "react-joyride";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "livreos:pending-help-tour";

type PendingTour = {
  articleId: string;
  steps: Step[];
  targetRoute: string | null;
};

function readPendingTour(): PendingTour | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as PendingTour : null;
  } catch {
    return null;
  }
}

function clearPendingTour() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage indisponível */ }
}

export function queueHelpTour(tour: PendingTour) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tour));
    window.dispatchEvent(new CustomEvent("livreos:help-tour-ready"));
  } catch {
    toast.error("Não foi possível iniciar o treinamento neste navegador.");
  }
}

export function HelpTourRunner() {
  const location = useLocation();
  const [tour, setTour] = useState<PendingTour | null>(null);
  const [run, setRun] = useState(false);
  const timerRef = useRef<number | null>(null);

  const tryStart = useCallback(() => {
    const pending = readPendingTour();
    if (!pending) return;
    if (pending.targetRoute && pending.targetRoute !== location.pathname) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setTour(pending);
      setRun(true);
    }, 450);
  }, [location.pathname]);

  useEffect(() => {
    tryStart();
    const onReady = () => tryStart();
    window.addEventListener("livreos:help-tour-ready", onReady);
    return () => {
      window.removeEventListener("livreos:help-tour-ready", onReady);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [tryStart]);

  const finish = async (status: "completed" | "skipped") => {
    const articleId = tour?.articleId;
    clearPendingTour();
    setRun(false);
    setTour(null);
    if (!articleId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("wiki_tour_progress").upsert(
      { user_id: user.id, article_id: articleId, status, completed_at: new Date().toISOString() },
      { onConflict: "user_id,article_id" },
    );
    if (!error && status === "completed") toast.success("Treinamento concluído e marcado como visto.");
  };

  const handleCallback = (event: EventData) => {
    if (event.status === "finished") void finish("completed");
    if (event.status === "skipped") void finish("skipped");
    if (event.action === "close") void finish("skipped");
  };

  if (!tour || !run) return null;
  return (
    <Joyride
      steps={tour.steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleCallback}
      options={{
        showProgress: true,
        buttons: ["back", "close", "primary", "skip"],
        primaryColor: "hsl(var(--primary))",
      }}
      styles={{
        floater: { zIndex: 1100 },
        tooltip: {
          backgroundColor: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
        },
      }}
      locale={{ back: "Voltar", close: "Fechar", last: "Finalizar", next: "Próximo", skip: "Pular" }}
    />
  );
}
