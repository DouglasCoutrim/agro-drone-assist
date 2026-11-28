import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNotificacoesAoVivo, type NotificacaoAoVivo } from "@/hooks/useNotificacoesAoVivo";
import {
  destravarSomNoPrimeiroToque,
  desbloquearAudio,
  setSomAtivado,
  tocarSomNotificacao,
} from "@/lib/notification-sound";
import { enablePush, getPushStatus } from "@/lib/web-push";
import { PopupNotificacao } from "./PopupNotificacao";

const DISPENSA_KEY = "livreos:pedido-notificacao-dispensado";
const DIAS_ATE_PERGUNTAR_DE_NOVO = 7;
const MAX_POPUPS = 3;
const SEGUNDOS_VISIVEL = 12;

interface PopupAberto extends NotificacaoAoVivo {
  chave: string;
}

function dispensaRecente() {
  const valor = localStorage.getItem(DISPENSA_KEY);
  if (!valor) return false;
  const dias = (Date.now() - Number(valor)) / 86400000;
  return Number.isFinite(dias) && dias < DIAS_ATE_PERGUNTAR_DE_NOVO;
}

/**
 * Central de avisos do app: mostra o pop-up na tela assim que a notificação
 * chega (Supabase Realtime), toca o som, dispara a notificação do sistema quando
 * a aba não está visível e pede a autorização ao usuário quando ainda não houve
 * uma decisão.
 */
export function NotificadorGlobal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [popups, setPopups] = useState<PopupAberto[]>([]);
  const [statusPush, setStatusPush] = useState<string>("loading");
  const [ativando, setAtivando] = useState(false);
  const [pediu, setPediu] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Libera o áudio no primeiro toque do usuário em qualquer parte da tela.
  useEffect(() => destravarSomNoPrimeiroToque(), []);

  useEffect(() => {
    if (!user) {
      setStatusPush("loading");
      return;
    }
    getPushStatus()
      .then(setStatusPush)
      .catch(() => setStatusPush("unsupported"));
  }, [user]);

  const fechar = useCallback((chave: string) => {
    clearTimeout(timers.current[chave]);
    delete timers.current[chave];
    setPopups((atual) => atual.filter((p) => p.chave !== chave));
  }, []);

  const abrir = useCallback(
    async (popup: PopupAberto) => {
      fechar(popup.chave);
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", popup.id);
      if (popup.link) navigate(popup.link);
    },
    [fechar, navigate],
  );

  const receber = useCallback(
    (nova: NotificacaoAoVivo) => {
      const popup: PopupAberto = { ...nova, chave: `${nova.id}-${Date.now()}` };
      setPopups((atual) => [...atual, popup].slice(-MAX_POPUPS));
      timers.current[popup.chave] = setTimeout(() => fechar(popup.chave), SEGUNDOS_VISIVEL * 1000);

      tocarSomNotificacao();

      // Aba em segundo plano: avisa pelo sistema operacional (se autorizado).
      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
        const doSistema = new Notification(nova.titulo, {
          body: nova.corpo ?? undefined,
          icon: "/icons/icon-192.png",
          tag: nova.id,
        });
        doSistema.onclick = () => {
          window.focus();
          if (nova.link) navigate(nova.link);
          doSistema.close();
        };
      }
    },
    [fechar, navigate],
  );

  useNotificacoesAoVivo(receber);

  useEffect(() => {
    const pendentes = timers.current;
    return () => {
      Object.values(pendentes).forEach(clearTimeout);
    };
  }, []);

  const ativar = async () => {
    if (!user) return;
    setAtivando(true);
    try {
      await enablePush(user.id);
      // Autorizou as notificações: liga e destrava o som no mesmo gesto.
      setSomAtivado(true);
      desbloquearAudio();
      tocarSomNotificacao(true);
      toast.success("Notificações e som ativados neste aparelho");
      setPediu(true);
      setStatusPush(await getPushStatus());
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Não foi possível ativar as notificações.";
      toast.error(mensagem);
      setStatusPush(await getPushStatus());
    } finally {
      setAtivando(false);
    }
  };

  const dispensar = () => {
    localStorage.setItem(DISPENSA_KEY, String(Date.now()));
    setPediu(true);
  };

  if (!user) return null;

  // Só pede quando o aparelho ainda aceita a pergunta (status "off") e o usuário
  // não disse "agora não" nos últimos dias. "iframe"/"denied"/"unsupported" ficam
  // explicados no card de Configurações.
  const pedirPermissao = !pediu && statusPush === "off" && !dispensaRecente();

  return (
    <div className="pointer-events-none fixed right-3 top-[calc(var(--header-height)+env(safe-area-inset-top)+0.75rem)] z-[60] w-[min(360px,calc(100vw-1.5rem))] space-y-2 sm:right-4">
      {popups.map((p) => (
        <PopupNotificacao
          key={p.chave}
          tipo={p.tipo}
          titulo={p.titulo}
          corpo={p.corpo}
          aoAbrir={() => abrir(p)}
          aoFechar={() => fechar(p.chave)}
        />
      ))}

      {pedirPermissao && (
        <div className="pointer-events-auto rounded-xl border border-primary/30 bg-card p-3 shadow-xl animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
              <BellRing className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Ativar notificações e som</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Receba os avisos de OS, compras e financeiro na hora, com aviso sonoro neste aparelho.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dispensar} disabled={ativando}>
              Agora não
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={ativar} disabled={ativando}>
              {ativando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ativar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
