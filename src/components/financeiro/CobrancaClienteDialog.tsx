import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Send, Copy, MessageCircle, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { formatCurrency } from "@/lib/formatters";
import { fetchOsComValores, fetchPagamentoConfig, OsCobranca, PagamentoConfig } from "@/lib/os-billing";
import { montarMensagemCobranca, openWhatsApp } from "@/lib/whatsapp-templates";

interface ClienteLite { id: string; nome: string; telefone: string | null }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteIdInicial?: string;
}

export function CobrancaClienteDialog({ open, onOpenChange, clienteIdInicial }: Props) {
  const { organization } = useOrganization();
  const { config } = useEmpresaConfig();

  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [busca, setBusca] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [ordens, setOrdens] = useState<OsCobranca[]>([]);
  const [selecionadas, setSelecionadas] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [pagamento, setPagamento] = useState<PagamentoConfig>({ gateway: "none" });
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!open || !organization?.id) return;
    setClienteId(clienteIdInicial || "");
    setBusca("");
    setObservacao("");
    setSelecionadas({});
    setOrdens([]);
    (async () => {
      const [{ data }, pg] = await Promise.all([
        supabase.from("clientes").select("id, nome, telefone").eq("organization_id", organization.id).order("nome"),
        fetchPagamentoConfig(organization.id),
      ]);
      setClientes((data as any) || []);
      setPagamento(pg);
    })();
  }, [open, organization?.id, clienteIdInicial]);

  useEffect(() => {
    if (!open || !organization?.id || !clienteId) { setOrdens([]); return; }
    setLoading(true);
    fetchOsComValores(organization.id, clienteId)
      .then(list => {
        setOrdens(list);
        const pre: Record<string, boolean> = {};
        list.filter(o => !o.pago && o.valor > 0).forEach(o => { pre[o.id] = true; });
        setSelecionadas(pre);
      })
      .catch(() => toast.error("Erro ao carregar ordens de serviço"))
      .finally(() => setLoading(false));
  }, [open, organization?.id, clienteId]);

  const clientesFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return clientes.slice(0, 30);
    return clientes.filter(c => c.nome.toLowerCase().includes(t) || (c.telefone || "").includes(t)).slice(0, 30);
  }, [clientes, busca]);

  const cliente = clientes.find(c => c.id === clienteId) || null;
  const selecionadasList = ordens.filter(o => selecionadas[o.id]);
  const total = selecionadasList.reduce((s, o) => s + o.valor, 0);

  const mensagem = cliente
    ? montarMensagemCobranca(
        cliente.nome,
        config.nome_empresa || "nossa oficina",
        selecionadasList.map(o => ({ numero: o.numero, equipamento: o.equipamento, valor: o.valor })),
        {
          gateway: pagamento.gateway,
          pix_key_type: pagamento.pix_key_type,
          pix_key_value: pagamento.pix_key_value,
          pix_receiver_name: pagamento.pix_receiver_name,
        },
        observacao || undefined
      )
    : "";

  const enviar = () => {
    if (!cliente) return;
    if (selecionadasList.length === 0) { toast.error("Selecione ao menos uma OS"); return; }
    if (!cliente.telefone) { toast.error("Cliente sem telefone cadastrado"); return; }
    openWhatsApp(cliente.telefone, mensagem);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />Cobrar Cliente por WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione o cliente, marque as ordens de serviço a cobrar e envie o lembrete com sua chave PIX.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label className="text-xs">1. Cliente</Label>
            {cliente ? (
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-md bg-primary/10"><User className="h-3.5 w-3.5 text-primary" /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{cliente.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{cliente.telefone || "Sem telefone"}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setClienteId("")}>Trocar</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 h-9 text-sm" placeholder="Buscar cliente por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                  {clientesFiltrados.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground text-center">Nenhum cliente encontrado</p>
                  ) : clientesFiltrados.map(c => (
                    <button key={c.id} type="button" className="w-full text-left p-2.5 hover:bg-muted/40 transition-colors" onClick={() => setClienteId(c.id)}>
                      <p className="text-sm font-medium">{c.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{c.telefone || "Sem telefone"}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* OS */}
          {clienteId && (
            <div className="space-y-2">
              <Label className="text-xs">2. Ordens de serviço</Label>
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : ordens.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma OS encontrada para este cliente.</p>
              ) : (
                <div className="space-y-1.5">
                  {ordens.map(os => (
                    <label key={os.id} className={`flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${selecionadas[os.id] ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-muted/30"}`}>
                      <Checkbox
                        checked={!!selecionadas[os.id]}
                        onCheckedChange={(v) => setSelecionadas(s => ({ ...s, [os.id]: !!v }))}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-medium">{os.numero}</span>
                          {os.pago ? (
                            <Badge variant="secondary" className="text-[10px] h-4 gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />Recebido</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4">Em aberto</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{os.equipamento}</p>
                      </div>
                      <span className="text-sm font-bold shrink-0">{formatCurrency(os.valor)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Total + mensagem */}
          {selecionadasList.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">{selecionadasList.length} OS selecionada(s)</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
              </div>

              {!pagamento.pix_key_value && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-500/10 p-2.5 text-[11px]">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <span>Nenhuma chave PIX configurada. Configure em <b>Configurações → Recebimento</b> para incluir a chave automaticamente na mensagem.</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Observação (opcional)</Label>
                <Textarea rows={2} value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: pagamento até sexta-feira" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Pré-visualização</Label>
                <pre className="text-[11px] whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-3 max-h-48 overflow-y-auto font-sans">{mensagem}</pre>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(mensagem); toast.success("Mensagem copiada"); }}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar
                </Button>
                <Button size="sm" className="gradient-primary" onClick={enviar}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />Enviar no WhatsApp
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
