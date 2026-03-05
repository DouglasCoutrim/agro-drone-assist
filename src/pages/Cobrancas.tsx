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

interface AsaasPayment {
  id: string;
  customer: string;
  customerName?: string;
  value: number;
  dueDate: string;
  status: string;
  billingType: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  description?: string;
  externalReference?: string;
}

export default function Cobrancas() {
  const [payments, setPayments] = useState<AsaasPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<AsaasPayment | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    valor: 0,
    vencimento: "",
    tipo: "PIX",
    descricao: "",
    externalReference: ""
  });

  useEffect(() => { fetchPayments(); }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {

      // Use query params approach
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas?action=list_payments`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
          },
        }
      );
      const result = await res.json();
      if (result.data) {
        setPayments(result.data);
      } else if (result.error) {
        toast.error('Erro Asaas: ' + result.error);
      }
    } catch (error: any) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas?action=create_payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: formData.customerId,
            billingType: formData.tipo,
            value: formData.valor,
            dueDate: formData.vencimento,
            description: formData.descricao,
            externalReference: formData.externalReference || undefined,
          }),
        }
      );
      const result = await res.json();
      if (result.id) {
        toast.success('Cobrança criada com sucesso!');
        setDialogOpen(false);
        setFormData({ customerId: "", valor: 0, vencimento: "", tipo: "PIX", descricao: "", externalReference: "" });
        fetchPayments();
      } else {
        toast.error('Erro: ' + JSON.stringify(result.errors || result));
      }
    } catch (error: any) {
      toast.error('Erro ao criar cobrança: ' + error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle }> = {
      'PENDING': { label: 'Pendente', variant: 'secondary', icon: Clock },
      'RECEIVED': { label: 'Recebido', variant: 'default', icon: CheckCircle },
      'CONFIRMED': { label: 'Confirmado', variant: 'default', icon: CheckCircle },
      'OVERDUE': { label: 'Vencido', variant: 'destructive', icon: AlertTriangle },
      'REFUNDED': { label: 'Estornado', variant: 'outline', icon: XCircle },
      'CANCELLED': { label: 'Cancelado', variant: 'outline', icon: XCircle },
      'RECEIVED_IN_CASH': { label: 'Recebido em Dinheiro', variant: 'default', icon: CheckCircle },
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
  const totalRecebido = payments.filter(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH').reduce((a, p) => a + p.value, 0);
  const totalVencido = payments.filter(p => p.status === 'OVERDUE').reduce((a, p) => a + p.value, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><CreditCard className="h-8 w-8 text-primary" />Cobranças Asaas</h1>
            <p className="text-muted-foreground">Gerencie cobranças e pagamentos integrados ao Asaas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchPayments} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-medium"><Plus className="mr-2 h-4 w-4" />Gerar Cobrança</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Cobrança Asaas</DialogTitle>
                  <DialogDescription>Gere uma cobrança via Pix, Boleto ou Cartão de Crédito</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>ID do Cliente Asaas *</Label>
                      <Input value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value })} placeholder="cus_XXXXXX" required />
                      <p className="text-xs text-muted-foreground">Crie o cliente no Asaas primeiro ou use o ID existente</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor (R$) *</Label>
                      <Input type="number" step="0.01" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Vencimento *</Label>
                      <Input type="date" value={formData.vencimento} onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Forma de Pagamento *</Label>
                      <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PIX">⚡ Pix</SelectItem>
                          <SelectItem value="BOLETO">📄 Boleto</SelectItem>
                          <SelectItem value="CREDIT_CARD">💳 Cartão de Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Referência (OS)</Label>
                      <Input value={formData.externalReference} onChange={(e) => setFormData({ ...formData, externalReference: e.target.value })} placeholder="2026-00001" />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" className="gradient-primary" disabled={formLoading}>
                      {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Send className="mr-2 h-4 w-4" />Gerar Cobrança
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Receipt className="h-5 w-5 text-primary" /></div>
                <div><p className="text-sm text-muted-foreground">Total Cobranças</p><p className="text-2xl font-bold">{payments.length}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
                <div><p className="text-sm text-muted-foreground">Recebido</p><p className="text-2xl font-bold text-success">{formatCurrency(totalRecebido)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
                <div><p className="text-sm text-muted-foreground">Pendente</p><p className="text-2xl font-bold text-warning">{formatCurrency(totalPendente)}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
                <div><p className="text-sm text-muted-foreground">Vencido</p><p className="text-2xl font-bold text-destructive">{formatCurrency(totalVencido)}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por descrição, ID ou cliente..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Lista de Cobranças</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma cobrança encontrada</p>
                <p className="text-sm mt-1">Clique em "Gerar Cobrança" para criar a primeira</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPayments.map((p) => {
                  const sc = getStatusConfig(p.status);
                  const StatusIcon = sc.icon;
                  return (
                    <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-primary text-sm">{p.id}</p>
                          <Badge variant={sc.variant} className="flex items-center gap-1"><StatusIcon className="h-3 w-3" />{sc.label}</Badge>
                        </div>
                        <p className="text-sm">{p.description || '—'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{getTipoPagamento(p.billingType)}</span>
                          <span>•</span>
                          <span>Venc: {new Date(p.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`text-xl font-bold ${['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status) ? 'text-success' : p.status === 'OVERDUE' ? 'text-destructive' : 'text-foreground'}`}>
                          {formatCurrency(p.value)}
                        </p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setDetailDialog(p)}><Eye className="h-4 w-4" /></Button>
                          {p.invoiceUrl && (
                            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(p.invoiceUrl!); toast.success('Link copiado!'); }}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        {detailDialog && (
          <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Detalhes da Cobrança</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">ID</p><p className="font-medium text-sm">{detailDialog.id}</p></div>
                  <div><p className="text-sm text-muted-foreground">Status</p><Badge variant={getStatusConfig(detailDialog.status).variant}>{getStatusConfig(detailDialog.status).label}</Badge></div>
                  <div><p className="text-sm text-muted-foreground">Valor</p><p className="font-bold text-primary">{formatCurrency(detailDialog.value)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Forma</p><p className="font-medium">{getTipoPagamento(detailDialog.billingType)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Vencimento</p><p className="font-medium">{new Date(detailDialog.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p></div>
                  {detailDialog.description && <div className="col-span-2"><p className="text-sm text-muted-foreground">Descrição</p><p className="font-medium">{detailDialog.description}</p></div>}
                </div>
                {detailDialog.invoiceUrl && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm font-medium mb-2">Link de Pagamento</p>
                    <div className="flex items-center gap-2">
                      <Input value={detailDialog.invoiceUrl} readOnly className="text-xs" />
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(detailDialog.invoiceUrl!); toast.success('Link copiado!'); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {detailDialog.invoiceUrl && (
                    <Button variant="outline" className="flex-1" onClick={() => window.open(detailDialog.invoiceUrl, '_blank')}>
                      <ExternalLink className="mr-2 h-4 w-4" />Abrir Fatura
                    </Button>
                  )}
                  {detailDialog.bankSlipUrl && (
                    <Button variant="outline" className="flex-1" onClick={() => window.open(detailDialog.bankSlipUrl, '_blank')}>
                      <ExternalLink className="mr-2 h-4 w-4" />Ver Boleto
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
