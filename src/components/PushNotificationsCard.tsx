import { useEffect, useState } from "react";
import { BellRing, Loader2, PlayCircle, Volume2, VolumeX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { disablePush, enablePush, getPushStatus } from "@/lib/web-push";
import { desbloquearAudio, isSomAtivado, setSomAtivado, tocarSomNotificacao } from "@/lib/notification-sound";

const hints: Record<string, string> = {
  unsupported: "Este navegador não suporta. No iPhone, adicione o LivreOS à tela de início e abra por lá.",
  iframe: "Abra o sistema em uma aba própria ou pelo app instalado para ativar.",
  denied: "As notificações foram bloqueadas. Libere nas configurações do navegador/celular.",
};

export function PushNotificationsCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("loading");
  const [busy, setBusy] = useState(false);
  const [somLigado, setSomLigado] = useState(isSomAtivado());

  useEffect(() => { getPushStatus().then(setStatus).catch(() => setStatus("unsupported")); }, []);

  const toggle = async (on: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      if (on) {
        await enablePush(user.id);
        // Autorizou as notificações: liga e destrava o som no mesmo toque.
        setSomAtivado(true);
        setSomLigado(true);
        desbloquearAudio();
        toast.success("Notificações ativadas neste aparelho");
      } else {
        await disablePush();
        toast.success("Notificações desativadas neste aparelho");
      }
      setStatus(await getPushStatus());
    } catch (e: any) { toast.error(e.message ?? "Não foi possível alterar"); setStatus(await getPushStatus()); }
    finally { setBusy(false); }
  };

  const alternarSom = (on: boolean) => {
    setSomAtivado(on);
    setSomLigado(on);
    if (on) {
      desbloquearAudio();
      tocarSomNotificacao(true);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" />Notificações neste aparelho</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Receber avisos mesmo com o app fechado</span>
            {status === "loading" || busy ? <Loader2 className="h-4 w-4 animate-spin" /> :
              <Switch checked={status === "on"} disabled={!!hints[status]} onCheckedChange={toggle} aria-label="Notificações push" />}
          </div>
          {hints[status] && <p className="text-xs text-muted-foreground">{hints[status]}</p>}
          {status === "off" && <p className="text-xs text-muted-foreground">Ative em cada aparelho que você usa.</p>}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Som nos avisos que aparecem na tela</span>
            <Switch checked={somLigado} onCheckedChange={alternarSom} aria-label="Som das notificações" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              {somLigado ? <Volume2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <VolumeX className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
              O navegador só libera o áudio depois do primeiro toque na tela.
            </p>
            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => alternarSom(true)}>
              <PlayCircle className="h-3.5 w-3.5 mr-1" />Testar som
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
