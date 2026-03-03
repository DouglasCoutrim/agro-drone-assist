import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  CreditCard, Plus, Search, DollarSign, Clock, CheckCircle, XCircle, AlertTriangle, Send, Eye, Copy, Loader2, ExternalLink, Receipt
} from "lucide-react";
import { toast } from "sonner";

// Tipos simulados para integração Asaas
interface CobrancaAsaas {
  id: string;
  cliente: string;
  valor: number;
  vencimento: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED';
  tipo: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  linkPagamento?: string;
  descricao: string;
  ordemServicoId?: string;
}

// Dados mock para demonstração
const mockCobrancas: CobrancaAsaas[] = [
  { id: 'cob_001', cliente: 'Fazenda Santa Clara', valor: 2500, vencimento: '2026-03-10', status: 'PENDING', tipo: 'PIX', descricao: 'OS 2026-00001 - Manutenção Drone Agrícola', linkPagamento: 'https://asaas.com/pay/mock1' },
  { id: 'cob_002', cliente: 'Agro Drones Ltda', valor: 850, vencimento: '2026-03-05', status: 'RECEIVED', tipo: 'BOLETO', descricao: 'OS 2026-00002 - Troca de bateria DJI T40' },
  { id: 'cob_003', cliente: 'Carlos Mendes', valor: 1200, vencimento: '2026-02-28', status: 'OVERDUE', tipo: 'PIX', descricao: 'OS 2026-00003 - Reparo controle remoto' },
  { id: 'cob_004', cliente: 'Cooperativa Agrícola', valor: 4500, vencimento: '2026-03-15', status: 'CONFIRMED', tipo: 'CREDIT_CARD', descricao: 'OS 2026-00004 - Revisão completa drone enterprise' },
];

export default function Cobrancas() {
  const [cobrancas] = useState<CobrancaAsaas[]>(mockCobrancas);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<CobrancaAsaas | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    cliente: "",
    valor: 0,
    vencimento: "",
    tipo: "PIX" as 'PIX' | 'BOLETO' | 'CREDIT_CARD',
    descricao: "",
    ordemServicoId: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    // Simula chamada à API
    await new Promise(r => setTimeout(r, 1500));
    setFormLoading(false);
    setDialogOpen(false);
    toast.info('⚠️ Integração Asaas: Esta funcionalidade será conectada via Edge Functions. Cobrança simulada criada com sucesso!');
    setFormData({ cliente: "", valor: 0, vencimento: "", tipo: "PIX", descricao: "", ordemServicoId: "" });
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle }> = {
      'PENDING': { label: 'Pendente', variant: 'secondary', icon: Clock },
      'RECEIVED': { label: 'Recebido', variant: 'default', icon: CheckCircle },
      'CONFIRMED': { label: 'Confirmado', variant: 'default', icon: CheckCircle },
      'OVERDUE': { label: 'Vencido', variant: 'destructive', icon: AlertTriangle },
      'REFUNDED': { label: 'Estornado', variant: 'outline', icon: XCircle },
      'CANCELLED': { label: 'Cancelado', variant: 'outline', icon: XCircle },
    };
    return config[status] || { label: status, variant: 'outline' as const, icon: Clock };
  };

  const getTipoPagamento = (tipo: string) => {
    const tipos: Record<string, string> = { 'PIX': '⚡ Pix', 'BOLETO': '📄 Boleto', 'CREDIT_CARD': '💳 Cartão' };
    return tipos[tipo] || tipo;
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const filteredCobrancas = cobrancas.filter(c =>
    c.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPendente = cobrancas.filter(c => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((a, c) => a + c.valor, 0);
  const totalRecebido = cobrancas.filter(c => c.status === 'RECEIVED' || c.status === 'CONFIRMED').reduce((a, c) => a + c.valor, 0);
  const totalVencido = cobrancas.filter(c => c.status === 'OVERDUE').reduce((a, c) => a + c.valor, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-primary" />
              Cobranças Asaas
            </h1>
            <p className="text-muted-foreground">Gerencie cobranças e pagamentos integrados ao Asaas</p>
          </div>
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
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-warning flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Modo demonstração - Integração real será via Edge Functions</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Cliente *</Label>
                    <Input value={formData.cliente} onChange={(e) => setFormData({ ...formData, cliente: e.target.value })} placeholder="Nome do cliente" required />
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
                    <Select value={formData.tipo} onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PIX">⚡ Pix</SelectItem>
                        <SelectItem value="BOLETO">📄 Boleto</SelectItem>
                        <SelectItem value="CREDIT_CARD">💳 Cartão de Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nº da OS (opcional)</Label>
                    <Input value={formData.ordemServicoId} onChange={(e) => setFormData({ ...formData, ordemServicoId: e.target.value })} placeholder="2026-00001" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Descrição *</Label>
                    <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} required />
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-soft card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Receipt className="h-5 w-5 text-primary" /></div>
                <div><p className="text-sm text-muted-foreground">Total Cobranças</p><p className="text-2xl font-bold">{cobrancas.length}</p></div>
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
              <Input placeholder="Buscar por cliente, descrição ou ID..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Cobrancas List */}
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Lista de Cobranças</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCobrancas.map((cob) => {
                const statusConfig = getStatusConfig(cob.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <div key={cob.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-primary">{cob.id}</p>
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1"><StatusIcon className="h-3 w-3" />{statusConfig.label}</Badge>
                      </div>
                      <p className="text-sm font-medium">{cob.cliente}</p>
                      <p className="text-xs text-muted-foreground">{cob.descricao}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{getTipoPagamento(cob.tipo)}</span>
                        <span>•</span>
                        <span>Venc: {new Date(cob.vencimento).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className={`text-xl font-bold ${cob.status === 'RECEIVED' || cob.status === 'CONFIRMED' ? 'text-success' : cob.status === 'OVERDUE' ? 'text-destructive' : 'text-foreground'}`}>
                        {formatCurrency(cob.valor)}
                      </p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetailDialog(cob)}><Eye className="h-4 w-4" /></Button>
                        {cob.linkPagamento && (
                          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(cob.linkPagamento!); toast.success('Link copiado!'); }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="shadow-soft border-l-4 border-l-warning">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-warning/10"><AlertTriangle className="h-6 w-6 text-warning" /></div>
              <div>
                <h3 className="font-semibold mb-1">Integração Asaas - Modo Demonstração</h3>
                <p className="text-sm text-muted-foreground">
                  Esta tela está preparada para integração com a API do Asaas. As chamadas reais serão feitas via Edge Functions (backend) para proteger sua chave de API. 
                  Para ativar, configure a chave do Asaas nas configurações do sistema.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        {detailDialog && (
          <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Detalhes da Cobrança</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">ID</p><p className="font-medium">{detailDialog.id}</p></div>
                  <div><p className="text-sm text-muted-foreground">Status</p><Badge variant={getStatusConfig(detailDialog.status).variant}>{getStatusConfig(detailDialog.status).label}</Badge></div>
                  <div><p className="text-sm text-muted-foreground">Cliente</p><p className="font-medium">{detailDialog.cliente}</p></div>
                  <div><p className="text-sm text-muted-foreground">Valor</p><p className="font-bold text-primary">{formatCurrency(detailDialog.valor)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Forma de Pagamento</p><p className="font-medium">{getTipoPagamento(detailDialog.tipo)}</p></div>
                  <div><p className="text-sm text-muted-foreground">Vencimento</p><p className="font-medium">{new Date(detailDialog.vencimento).toLocaleDateString('pt-BR')}</p></div>
                  <div className="col-span-2"><p className="text-sm text-muted-foreground">Descrição</p><p className="font-medium">{detailDialog.descricao}</p></div>
                </div>
                {detailDialog.linkPagamento && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm font-medium mb-2">Link de Pagamento</p>
                    <div className="flex items-center gap-2">
                      <Input value={detailDialog.linkPagamento} readOnly className="text-xs" />
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(detailDialog.linkPagamento!); toast.success('Link copiado!'); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => toast.info('Funcionalidade será ativada com integração Asaas')}>
                    <Send className="mr-2 h-4 w-4" />Enviar p/ Cliente
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast.info('Funcionalidade será ativada com integração Asaas')}>
                    <ExternalLink className="mr-2 h-4 w-4" />Abrir no Asaas
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </MainLayout>
  );
}
