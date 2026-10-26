import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { disablePush, enablePush, getPushStatus } from "@/lib/web-push";

const hints: Record<string, string> = {
  unsupported: "Este navegador não suporta. No iPhone, adicione o LivreOS à tela de início e abra por lá.",
  iframe: "Abra o sistema em uma aba própria ou pelo app instalado para ativar.",
  denied: "As notificações foram bloqueadas. Libere nas configurações do navegador/celular.",
};

export function PushNotificationsCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPushStatus().then(setStatus).catch(() => setStatus("unsupported")); }, []);

  const toggle = async (on: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      if (on) { await enablePush(user.id); toast.success("Notificações ativadas neste aparelho"); }
      else { await disablePush(); toast.success("Notificações desativadas neste aparelho"); }
      setStatus(await getPushStatus());
    } catch (e: any) { toast.error(e.message ?? "Não foi possível alterar"); setStatus(await getPushStatus()); }
    finally { setBusy(false); }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-primary" />Notificações no celular</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Receber avisos mesmo com o app fechado</span>
          {status === "loading" || busy ? <Loader2 className="h-4 w-4 animate-spin" /> :
            <Switch checked={status === "on"} disabled={!!hints[status]} onCheckedChange={toggle} aria-label="Notificações push" />}
        </div>
        {hints[status] && <p className="text-xs text-muted-foreground">{hints[status]}</p>}
        {status === "off" && <p className="text-xs text-muted-foreground">Ative em cada aparelho que você usa.</p>}
      </CardContent>
    </Card>
  );
}
