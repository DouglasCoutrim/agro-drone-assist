import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Ações que um passo pode executar antes de aparecer, guardadas em `step.data`.
 * É o que transforma o passeio em treinamento "mão na massa": o sistema abre o
 * formulário e já deixa um exemplo preenchido para o usuário concluir.
 */
type PassoAcao = {
  /** Seletor do atalho que abre o formulário desta etapa (ex.: o botão Novo). */
  abrir?: string;
  /** Valor de exemplo aplicado no próprio campo destacado (input de texto). */
  exemplo?: string;
  /** Outros campos preenchidos nesta mesma etapa. */
  campos?: { seletor: string; valor: string }[];
};

const espera = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

function clicarEm(seletor: string) {
  const alvo = document.querySelector<HTMLElement>(seletor);
  if (!alvo) return false;
  alvo.click();
  return true;
}

function preencherCampo(seletor: string, valor: string) {
  const campo = document.querySelector(seletor);
  if (!(campo instanceof HTMLInputElement) && !(campo instanceof HTMLTextAreaElement)) return false;

  // Inputs controlados do React ignoram `campo.value = x`; é preciso usar o
  // setter nativo e disparar o evento de input para o estado do formulário mudar.
  const prototipo =
    campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const definirValor = Object.getOwnPropertyDescriptor(prototipo, "value")?.set;
  if (!definirValor) return false;

  definirValor.call(campo, valor);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

async function executarAcao(step: Step) {
  const acao = (step.data ?? {}) as PassoAcao;

  if (acao.abrir) {
    // Abre o diálogo da etapa antes de procurar os campos dentro dele.
    if (clicarEm(acao.abrir)) await espera(500);
  }

  if (acao.exemplo && typeof step.target === "string") {
    preencherCampo(step.target, acao.exemplo);
    await espera(80);
  }

  if (acao.campos?.length) {
    acao.campos.forEach((campo) => preencherCampo(campo.seletor, campo.valor));
    await espera(80);
  }
}

export function HelpTourRunner() {
  const location = useLocation();
  const [tour, setTour] = useState<PendingTour | null>(null);
  const [run, setRun] = useState(false);
  const timerRef = useRef<number | null>(null);
  // O treinamento só conta como visto se pelo menos um destaque apareceu na tela.
  const exibiuDestaque = useRef(false);
  const destaquesNaoEncontrados = useRef(0);

  // Passos com ações (abrir formulário / preencher exemplo) viram passos com hook `before`.
  const passos = useMemo<Step[]>(
    () =>
      (tour?.steps ?? []).map((step) => {
        const acao = (step.data ?? {}) as PassoAcao;
        if (!acao.abrir && !acao.exemplo && !acao.campos?.length) return step;
        return { ...step, before: () => executarAcao(step) };
      }),
    [tour],
  );

  const tryStart = useCallback(() => {
    const pending = readPendingTour();
    if (!pending) return;
    if (pending.targetRoute && pending.targetRoute !== location.pathname) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    // Espera a tela terminar de montar antes de procurar os destaques.
    timerRef.current = window.setTimeout(() => {
      exibiuDestaque.current = false;
      destaquesNaoEncontrados.current = 0;
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
    const apareceu = exibiuDestaque.current;
    const pulados = destaquesNaoEncontrados.current;

    clearPendingTour();
    setRun(false);
    setTour(null);

    if (!articleId) return;

    // Nenhum destaque foi exibido: a tela mudou ou os elementos não existem mais.
    // Não registra como visto para não dar o treinamento por concluído por engano.
    if (status === "completed" && !apareceu) {
      toast.error("Não encontramos os destaques deste treinamento nesta tela. Tente novamente.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("wiki_tour_progress").upsert(
      { user_id: user.id, article_id: articleId, status, completed_at: new Date().toISOString() },
      { onConflict: "user_id,article_id" },
    );

    if (error) {
      toast.error("Não foi possível registrar o treinamento.");
      return;
    }

    if (status === "completed") {
      toast.success(
        pulados > 0
          ? "Treinamento concluído. Alguns destaques não estavam na tela e foram pulados."
          : "Treinamento concluído e marcado como visto.",
      );
    }
  };

  const handleCallback = (event: EventData) => {
    if (event.type === "tooltip" || event.type === "beacon") {
      exibiuDestaque.current = true;
      return;
    }
    if (event.type === "error:target_not_found") {
      destaquesNaoEncontrados.current += 1;
      return;
    }
    if (event.type === "tour:end") {
      void finish(event.status === "finished" ? "completed" : "skipped");
    }
  };

  if (!tour || !run) return null;

  return (
    <Joyride
      steps={passos}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleCallback}
      options={{
        showProgress: true,
        buttons: ["back", "close", "primary", "skip"],
        closeButtonAction: "skip",
        primaryColor: "hsl(var(--primary))",
        width: 360,
      }}
      styles={{
        floater: { zIndex: 1100 },
        tooltip: {
          backgroundColor: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 18px 40px -12px rgba(15, 23, 42, 0.35)",
        },
        tooltipContainer: { textAlign: "left" },
        tooltipTitle: { fontSize: 17, fontWeight: 700, marginBottom: 6 },
        tooltipContent: { fontSize: 13.5, lineHeight: 1.6, padding: 0 },
        tooltipFooter: { marginTop: 14, alignItems: "center" },
        buttonNext: { borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600 },
        buttonBack: { borderRadius: 10, fontSize: 13, marginRight: 8, color: "hsl(var(--muted-foreground))" },
        buttonSkip: { borderRadius: 10, fontSize: 13, color: "hsl(var(--muted-foreground))" },
        buttonClose: { width: 12, height: 12, top: 12, right: 12 },
      }}
      locale={{
        back: "Voltar",
        close: "Fechar",
        last: "Finalizar",
        next: "Próximo",
        nextWithProgress: "Próximo ({current} de {total})",
        skip: "Pular",
        open: "Abrir",
      }}
    />
  );
}
