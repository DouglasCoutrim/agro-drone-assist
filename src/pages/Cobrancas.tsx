import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Plus, Search, DollarSign, Clock, CheckCircle, XCircle, AlertTriangle, Send, Eye, Copy, Loader2, ExternalLink, Receipt, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Cliente = Tables<"clientes">;

interface AsaasPayment {
  id: string; customer: string; customerName?: string; value: number;
  dueDate: string; status: string; billingType: string;
  invoiceUrl?: string; bankSlipUrl?: string; description?: string; externalReference?: string;
}

export default function Cobrancas() {
  const [payments, setPayments] = useState<AsaasPayment[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<AsaasPayment | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    clienteId: "", valor: 0, vencimento: "", tipo: "PIX", descricao: "", externalReference: ""
  });

  useEffect(() => { fetchPayments(); fetchClientes(); }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase.from('clientes').select('*').order('nome');
      if (error) throw error;
      setClientes(data || []);
    } catch { /* silent */ }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas?action=list_payments`, {
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey },
      });
      const result = await res.json();
      if (result.data) setPayments(result.data);
      else if (result.error) toast.error('Erro: ' + result.error);
    } catch (error: any) { console.error('Error fetching payments:', error); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCliente = clientes.find(c => c.id === formData.clienteId);
    const asaasId = (selectedCliente as any)?.asaas_id;
    if (!asaasId) { toast.error('Cliente sem ID Asaas. Recadastre para sincronizar.'); return; }
    setFormLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas?action=create_payment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: asaasId, billingType: formData.tipo, value: formData.valor, dueDate: formData.vencimento, description: formData.descricao, externalReference: formData.externalReference || undefined }),
      });
      const result = await res.json();
      if (result.id) { toast.success('Cobrança criada!'); setDialogOpen(false); setFormData({ clienteId: "", valor: 0, vencimento: "", tipo: "PIX", descricao: "", externalReference: "" }); fetchPayments(); }
      else toast.error('Erro: ' + JSON.stringify(result.errors || result));
    } catch (error: any) { toast.error('Erro: ' + error.message); } finally { setFormLoading(false); }
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle }> = {
      'PENDING': { label: 'Pendente', variant: 'secondary', icon: Clock },
      'RECEIVED': { label: 'Recebido', variant: 'default', icon: CheckCircle },
      'CONFIRMED': { label: 'Confirmado', variant: 'default', icon: CheckCircle },
      'OVERDUE': { label: 'Vencido', variant: 'destructive', icon: AlertTriangle },
      'REFUNDED': { label: 'Estornado', variant: 'outline', icon: XCircle },
      'CANCELLED': { label: 'Cancelado', variant: 'outline', icon: XCircle },
      'RECEIVED_IN_CASH': { label: 'Recebido', variant: 'default', icon: CheckCircle },
    };
    return config[status] || { label: status, variant: 'outline' as const, icon: Clock };
  };

  const getTipoPagamento = (tipo: string) => {
    const tipos: Record<string, string> = { 'PIX': '⚡ Pix', 'BOLETO': '📄 Boleto', 'CREDIT_CARD': '💳 Cartão', 'UNDEFINED': '—' };
    return tipos[tipo] || tipo;
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const filteredPayments = payments.filter(p =>
    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPendente = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE').reduce((a, p) => a + p.value, 0);
  const totalRecebido = payments.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)).reduce((a, p) => a + p.value, 0);
  const totalVencido = payments.filter(p => p.status === 'OVERDUE').reduce((a, p) => a + p.value, 0);

  const hasData = payments.length > 0;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Cobranças</h1>
            <p className="text-xs text-muted-foreground">Cobranças integradas com Asaas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchPayments} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary"><Plus className="mr-1.5 h-3.5 w-3.5" />Gerar Cobrança</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-base">Nova Cobrança</DialogTitle>
                  <DialogDescription className="text-xs">Selecione o cliente e defina os dados</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Cliente *</Label>
                      <Select value={formData.clienteId} onValueChange={(v) => setFormData({ ...formData, clienteId: v })}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                        <SelectContent>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-1.5">
                                <span>{c.nome}</span>
                                {(c as any).asaas_id ? <span className="text-[10px] text-primary">✓</span> : <span className="text-[10px] text-muted-foreground">sem sync</span>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Valor (R$) *</Label><Input type="number" step="0.01" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })} required className="h-9" /></div>
                    <div className="space-y-1"><Label className="text-xs">Vencimento *</Label><Input type="date" value={formData.vencimento} onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })} required className="h-9" /></div>
                    <div className="space-y-1">
                      <Label className="text-xs">Forma *</Label>
                      <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PIX">⚡ Pix</SelectItem>
                          <SelectItem value="BOLETO">📄 Boleto</SelectItem>
                          <SelectItem value="CREDIT_CARD">💳 Cartão</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Referência</Label><Input value={formData.externalReference} onChange={(e) => setFormData({ ...formData, externalReference: e.target.value })} placeholder="OS Nº" className="h-9" /></div>
                    <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Descrição</Label><Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" size="sm" className="gradient-primary" disabled={formLoading}>
                      {formLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}<Send className="mr-1.5 h-3.5 w-3.5" />Gerar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="shadow-soft"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-primary/10"><Receipt className="h-4 w-4 text-primary" /></div><div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-lg font-bold">{payments.length}</p></div></div></CardContent></Card>
          <Card className="shadow-soft"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></div><div><p className="text-[10px] text-muted-foreground">Recebido</p><p className="text-lg font-bold text-success">{formatCurrency(totalRecebido)}</p></div></div></CardContent></Card>
          <Card className="shadow-soft"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-warning/10"><Clock className="h-4 w-4 text-warning" /></div><div><p className="text-[10px] text-muted-foreground">Pendente</p><p className="text-lg font-bold text-warning">{formatCurrency(totalPendente)}</p></div></div></CardContent></Card>
          <Card className="shadow-soft"><CardContent className="p-3"><div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-destructive/10"><AlertTriangle className="h-4 w-4 text-destructive" /></div><div><p className="text-[10px] text-muted-foreground">Vencido</p><p className="text-lg font-bold text-destructive">{formatCurrency(totalVencido)}</p></div></div></CardContent></Card>
        </div>

        {!hasData && !loading ? (
          /* Empty State */
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Receipt className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium mb-1">Nenhuma cobrança encontrada</h3>
              <p className="text-xs text-muted-foreground mb-4 text-center max-w-sm">Crie sua primeira cobrança integrando automaticamente com o Asaas para receber via Pix, Boleto ou Cartão.</p>
              <Button size="sm" className="gradient-primary" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />Gerar Primeira Cobrança
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por descrição, ID ou cliente..." className="pl-9 h-9 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {/* Payments List */}
            <Card className="shadow-soft">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredPayments.map((p) => {
                      const sc = getStatusConfig(p.status);
                      const StatusIcon = sc.icon;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Badge variant={sc.variant} className="text-[10px] px-1.5 py-0 gap-0.5"><StatusIcon className="h-2.5 w-2.5" />{sc.label}</Badge>
                              <span className="text-[10px] text-muted-foreground">{getTipoPagamento(p.billingType)}</span>
                            </div>
                            <p className="text-sm truncate">{p.description || p.id}</p>
                            <p className="text-[10px] text-muted-foreground">Venc: {new Date(p.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <p className={`text-sm font-bold ${['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status) ? 'text-success' : p.status === 'OVERDUE' ? 'text-destructive' : 'text-foreground'}`}>
                              {formatCurrency(p.value)}
                            </p>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetailDialog(p)}><Eye className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Detail Dialog */}
        {detailDialog && (
          <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle className="text-base">Detalhes da Cobrança</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] text-muted-foreground uppercase">ID</p><p className="text-xs font-medium">{detailDialog.id}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Status</p><Badge variant={getStatusConfig(detailDialog.status).variant} className="text-[10px]">{getStatusConfig(detailDialog.status).label}</Badge></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Valor</p><p className="font-bold text-primary">{formatCurrency(detailDialog.value)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Forma</p><p className="text-sm">{getTipoPagamento(detailDialog.billingType)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase">Vencimento</p><p className="text-sm">{new Date(detailDialog.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p></div>
                  {detailDialog.description && <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase">Descrição</p><p className="text-sm">{detailDialog.description}</p></div>}
                </div>
                {detailDialog.invoiceUrl && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs font-medium mb-1.5">Link de Pagamento</p>
                    <div className="flex items-center gap-2">
                      <Input value={detailDialog.invoiceUrl} readOnly className="text-[10px] h-8" />
                      <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => { navigator.clipboard.writeText(detailDialog.invoiceUrl!); toast.success('Copiado!'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {detailDialog.invoiceUrl && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(detailDialog.invoiceUrl, '_blank')}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Fatura
                    </Button>
                  )}
                  {detailDialog.bankSlipUrl && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(detailDialog.bankSlipUrl, '_blank')}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Boleto
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}
