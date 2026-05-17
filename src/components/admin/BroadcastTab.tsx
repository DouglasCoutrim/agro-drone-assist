import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Send, Globe, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Org { id: string; name: string; }

export default function BroadcastTab() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [target, setTarget] = useState<"global" | string>("global");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.from("organizations").select("id, name").order("name").then(({ data }) => {
      setOrgs((data || []) as Org[]);
    });
  }, []);

  const send = async () => {
    if (!title.trim()) { toast.error("Informe um título"); return; }
    setSending(true);
    try {
      if (target === "global") {
        const { error } = await supabase.rpc("notify_broadcast_global", {
          _type: "plataforma", _title: title, _body: body || null, _link: link || null,
        });
        if (error) throw error;
        toast.success("Aviso enviado a todos os tenants.");
      } else {
        const { error } = await supabase.rpc("notify_broadcast_org", {
          _org_id: target, _type: "plataforma", _title: title, _body: body || null, _link: link || null,
        });
        if (error) throw error;
        toast.success("Aviso enviado.");
      }
      setTitle(""); setBody(""); setLink("");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Enviar aviso</h3>
          <p className="text-xs text-muted-foreground">Notifique todos os tenants ou um específico.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Destinatário</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />Todos os tenants (broadcast)</span>
              </SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{o.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Manutenção programada" />
        </div>

        <div>
          <Label className="text-xs">Mensagem</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Detalhe o aviso…" />
        </div>

        <div>
          <Label className="text-xs">Link (opcional)</Label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/wiki/algum-artigo" />
        </div>

        <Button onClick={send} disabled={sending} className="w-full">
          <Send className="h-4 w-4 mr-2" />{sending ? "Enviando…" : "Enviar aviso"}
        </Button>
      </div>
    </Card>
  );
}
