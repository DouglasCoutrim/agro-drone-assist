import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, CheckCircle2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string; organization_id: string; user_id: string; subject: string; category: string;
  status: string; created_at: string; updated_at: string;
}
interface Message {
  id: string; ticket_id: string; sender_id: string; message: string; is_admin_reply: boolean; created_at: string;
}

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    open: 'bg-vc-red-light text-vc-red-text border-vc-red/20',
    in_progress: 'bg-vc-amber-light text-vc-amber-text border-vc-amber/20',
    resolved: 'bg-vc-green-light text-vc-green-text border-vc-green/20',
    closed: 'bg-muted text-muted-foreground border-border',
  };
  const label: Record<string, string> = { open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado' };
  return <Badge className={map[s] || ''}>{label[s] || s}</Badge>;
};

export default function SupportTab() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orgs, setOrgs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchTickets = async () => {
    const [t, o] = await Promise.all([
      supabase.from('support_tickets' as any).select('*').order('updated_at', { ascending: false }),
      supabase.from('organizations' as any).select('id,name'),
    ]);
    setTickets((t.data as any) || []);
    const map: Record<string, string> = {};
    ((o.data as any) || []).forEach((x: any) => { map[x.id] = x.name; });
    setOrgs(map);
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_messages' as any).select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    setMessages((data as any) || []);
  };

  useEffect(() => { fetchTickets(); }, []);
  useEffect(() => { if (selectedId) fetchMessages(selectedId); }, [selectedId]);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const sendReply = async () => {
    if (!selected || !reply.trim() || !user) return;
    setSending(true);
    const { error: mErr } = await supabase.from('support_messages' as any).insert({
      ticket_id: selected.id, sender_id: user.id, message: reply.trim(), is_admin_reply: true,
    });
    if (mErr) { setSending(false); return toast.error(mErr.message); }
    if (selected.status === 'open') {
      await supabase.from('support_tickets' as any).update({ status: 'in_progress' }).eq('id', selected.id);
    } else {
      // bump updated_at
      await supabase.from('support_tickets' as any).update({ updated_at: new Date().toISOString() }).eq('id', selected.id);
    }
    setReply('');
    setSending(false);
    toast.success('Resposta enviada');
    await Promise.all([fetchTickets(), fetchMessages(selected.id)]);
  };

  const markResolved = async () => {
    if (!selected) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from('support_tickets' as any).update({ status: 'resolved' }).eq('id', selected.id);
    setUpdatingStatus(false);
    if (error) return toast.error(error.message);
    toast.success('Ticket marcado como resolvido');
    fetchTickets();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-[600px]">
          {/* Lista */}
          <div className="border-r">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Tickets ({tickets.length})</p>
            </div>
            <ScrollArea className="h-[560px]">
              {tickets.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum ticket</p>
                </div>
              )}
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'w-full text-left p-3 border-b hover:bg-muted/50 transition-colors',
                    selectedId === t.id && 'bg-muted'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{t.subject}</p>
                    {statusBadge(t.status)}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{orgs[t.organization_id] || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.updated_at).toLocaleString('pt-BR')}
                  </p>
                </button>
              ))}
            </ScrollArea>
          </div>

          {/* Detalhe */}
          <div className="flex flex-col">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Selecione um ticket para visualizar</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{selected.subject}</h3>
                      {statusBadge(selected.status)}
                      <Badge variant="outline" className="text-xs capitalize">{selected.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {orgs[selected.organization_id] || '—'} · aberto em {new Date(selected.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {selected.status !== 'resolved' && (
                    <Button size="sm" variant="outline" onClick={markResolved} disabled={updatingStatus}>
                      {updatingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Resolver
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map((m) => (
                      <div key={m.id} className={cn('flex', m.is_admin_reply ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                          m.is_admin_reply ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}>
                          <p className="whitespace-pre-wrap break-words">{m.message}</p>
                          <p className={cn('text-[10px] mt-1 opacity-70')}>
                            {m.is_admin_reply ? 'Suporte' : 'Cliente'} · {new Date(m.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</p>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-3 border-t space-y-2">
                  <Textarea
                    placeholder="Digite sua resposta..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    maxLength={2000}
                  />
                  <div className="flex justify-end">
                    <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Enviar Resposta
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
