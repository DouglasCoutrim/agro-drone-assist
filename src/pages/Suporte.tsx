import { useEffect, useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, LifeBuoy, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
};
type Message = {
  id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
};

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Aberto", variant: "default" },
  in_progress: { label: "Em andamento", variant: "secondary" },
  resolved: { label: "Resolvido", variant: "outline" },
};

export default function Suporte() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("duvida");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets" as any)
      .select("*")
      .order("updated_at", { ascending: false });
    setTickets((data as any) || []);
    setLoading(false);
  };

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("support_messages" as any)
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages((data as any) || []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  useEffect(() => { loadTickets(); }, []);
  useEffect(() => { if (selected) loadMessages(selected.id); }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const interval = window.setInterval(() => loadMessages(selected.id), 15_000);
    return () => window.clearInterval(interval);
  }, [selected?.id]);

  const handleCreate = async () => {
    if (!newSubject.trim() || !newMessage.trim()) {
      toast.error("Preencha o assunto e a mensagem");
      return;
    }
    if (!user || !organization) return;
    setCreating(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets" as any)
      .insert({
        subject: newSubject.trim(),
        category: newCategory,
        user_id: user.id,
        organization_id: organization.id,
      })
      .select()
      .single();
    if (error || !ticket) {
      toast.error("Erro ao criar ticket: " + (error?.message || ""));
      setCreating(false);
      return;
    }
    await supabase.from("support_messages" as any).insert({
      ticket_id: (ticket as any).id,
      sender_id: user.id,
      message: newMessage.trim(),
      is_admin_reply: false,
    });
    toast.success("Ticket aberto com sucesso");
    setOpenNew(false);
    setNewSubject(""); setNewMessage(""); setNewCategory("duvida");
    setCreating(false);
    await loadTickets();
    setSelected(ticket as any);
  };

  const handleReply = async () => {
    if (!reply.trim() || !selected || !user) return;
    setSending(true);
    const { error } = await supabase.from("support_messages" as any).insert({
      ticket_id: selected.id,
      sender_id: user.id,
      message: reply.trim(),
      is_admin_reply: false,
    });
    if (error) { toast.error("Erro ao enviar"); setSending(false); return; }
    setReply("");
    await loadMessages(selected.id);
    setSending(false);
  };

  return (
    <MainLayout>
      <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-primary" /> Suporte
            </h1>
            <p className="text-sm text-muted-foreground">Abra tickets e converse com nossa equipe</p>
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Ticket</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Abrir novo ticket</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Assunto</Label>
                  <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Resumo do problema" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="duvida">Dúvida</SelectItem>
                      <SelectItem value="bug">Bug / Erro</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="sugestao">Sugestão</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mensagem</Label>
                  <Textarea rows={5} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Descreva em detalhes..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)]">
          <Card className="overflow-y-auto">
            {loading ? (
              <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>
            ) : tickets.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Nenhum ticket ainda
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition ${selected?.id === t.id ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium line-clamp-1">{t.subject}</p>
                      <Badge variant={statusMap[t.status]?.variant} className="text-[10px]">
                        {statusMap[t.status]?.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Selecione um ticket para ver a conversa
              </div>
            ) : (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{selected.subject}</h2>
                    <Badge variant={statusMap[selected.status]?.variant}>{statusMap[selected.status]?.label}</Badge>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.is_admin_reply ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.is_admin_reply ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                        <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                        <p className={`text-[10px] mt-1 ${m.is_admin_reply ? "text-muted-foreground" : "opacity-70"}`}>
                          {m.is_admin_reply ? "Suporte • " : ""}
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {selected.status !== "resolved" && (
                  <div className="border-t p-3 flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                      rows={2}
                      className="resize-none"
                    />
                    <Button onClick={handleReply} disabled={sending || !reply.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
