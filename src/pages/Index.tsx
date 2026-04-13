import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  FileText, Package, DollarSign, AlertTriangle, TrendingUp, Clock, CheckCircle, Users, Plus, Zap, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const TIPO_EQUIPAMENTO: Record<string, string> = {
  drone_agricola: "Drone Agrícola", drone_convencional: "Drone de Consumo",
  controle: "Controle", bateria: "Bateria", outro: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  recebido: { label: "Recebido", variant: "outline" },
  aguardando_diagnostico: { label: "Aguard. Diagnóstico", variant: "secondary" },
  aguardando_aprovacao: { label: "Aguard. Aprovação", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  em_reparo: { label: "Em Reparo", variant: "default" },
  em_testes: { label: "Em Testes", variant: "default" },
  pronto_retirada: { label: "Pronto p/ Retirada", variant: "default" },
  entregue: { label: "Entregue", variant: "default" },
  cancelada: { label: "Cancelado", variant: "destructive" },
  aberta: { label: "Aberta", variant: "outline" },
  em_andamento: { label: "Em Andamento", variant: "default" },
  aguardando_peca: { label: "Aguardando Peça", variant: "secondary" },
  concluida: { label: "Concluída", variant: "default" },
};

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ osAbertas: 0, osConcluidas: 0, itensEstoqueBaixo: 0, totalClientes: 0, faturamentoMes: 0 });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [overdueOS, setOverdueOS] = useState<any[]>([]);
  const [overduePayments, setOverduePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingOS, setViewingOS] = useState<any | null>(null);

  useEffect(() => { if (user) fetchDashboardData(); }, [user]);

  const fetchDashboardData = async () => {
    try {
      const { data: osAbertas } = await supabase.from('ordens_servico').select('id', { count: 'exact' }).in('status', ['aberta', 'em_andamento', 'aguardando_peca', 'recebido', 'aguardando_diagnostico', 'aguardando_aprovacao']);
      const { data: osConcluidas } = await supabase.from('ordens_servico').select('id', { count: 'exact' }).in('status', ['concluida', 'pronto_retirada', 'entregue']);
      const { data: itensEstoque } = await supabase.from('itens_estoque').select('*');
      const itensEstoqueBaixo = itensEstoque?.filter(item => item.quantidade <= item.estoque_minimo).length || 0;
      const { count: totalClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
      const { data: recentOSData } = await supabase.from('ordens_servico').select('*, clientes (nome, telefone)').order('created_at', { ascending: false }).limit(5);
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
      const { data: receitas } = await supabase.from('financeiro').select('valor').eq('tipo', 'receita').gte('data_transacao', startOfMonth.toISOString());
      const faturamentoMes = receitas?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

      const today = new Date().toISOString();
      const { data: overdueOSData } = await supabase
        .from('ordens_servico').select('*, clientes (nome, telefone)')
        .not('data_previsao', 'is', null).lt('data_previsao', today)
        .not('status', 'in', '("entregue","cancelada","pronto_retirada","concluida")')
        .order('data_previsao', { ascending: true }).limit(10);

      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas?action=list_payments&status=OVERDUE`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': anonKey } });
          const result = await res.json();
          setOverduePayments(result?.data || []);
        }
      } catch { /* silent - asaas may not be configured */ }

      setStats({ osAbertas: osAbertas?.length || 0, osConcluidas: osConcluidas?.length || 0, itensEstoqueBaixo, totalClientes: totalClientes || 0, faturamentoMes });
      setRecentOS(recentOSData || []);
      setOverdueOS(overdueOSData || []);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Dashboard</h1>
            <p className="text-xs text-muted-foreground">Visão geral da oficina</p>
          </div>
          <Button size="sm" className="gradient-primary shadow-soft" onClick={() => navigate('/ordens-servico')}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Nova OS
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => (
              <Card key={i} className="shadow-soft border-border/50"><CardContent className="p-3 sm:p-4"><div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-16" /></div></CardContent></Card>
            ))}
          </div>
        ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatsCard title="OS Abertas" value={stats.osAbertas.toString()} icon={FileText} variant="warning" onClick={() => navigate('/ordens-servico')} />
          <StatsCard title="Concluídas" value={stats.osConcluidas.toString()} icon={CheckCircle} variant="success" onClick={() => navigate('/ordens-servico')} />
          <StatsCard title="Estoque Baixo" value={stats.itensEstoqueBaixo.toString()} icon={AlertTriangle} variant="destructive" onClick={() => navigate('/estoque')} />
          <StatsCard title="Faturamento" value={formatCurrency(stats.faturamentoMes)} icon={DollarSign} variant="success" onClick={() => navigate('/financeiro')} />
        </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent OS */}
          <Card className="lg:col-span-2 shadow-soft border-border/50">
            <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="text-sm flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" />OS Recentes</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
              ) : recentOS.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhuma OS encontrada</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/ordens-servico')}>Criar primeira OS</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentOS.map((os) => (
                    <div key={os.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setViewingOS(os)}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-primary">{os.numero}</p>
                          <p className="text-xs text-muted-foreground truncate">{os.clientes?.nome || 'Cliente'}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{TIPO_EQUIPAMENTO[os.tipo_equipamento] || os.tipo_equipamento}</p>
                      </div>
                      {getStatusBadge(os.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="shadow-soft border-border/50">
            <CardHeader className="pb-2 px-4 pt-4"><CardTitle className="text-sm flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-warning" />Alertas</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {overdueOS.length > 0 && (
                  <div className="rounded-lg border-l-2 border-l-destructive bg-destructive/5 p-2.5 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => navigate('/ordens-servico')}>
                    <p className="text-xs font-medium text-destructive">🔴 {overdueOS.length} OS em Atraso</p>
                    {overdueOS.slice(0, 2).map(os => (
                      <p key={os.id} className="text-[10px] text-muted-foreground mt-0.5">• {os.numero} - {os.clientes?.nome || 'N/A'}</p>
                    ))}
                  </div>
                )}
                {overduePayments.length > 0 && (
                  <div className="rounded-lg border-l-2 border-l-destructive bg-destructive/5 p-2.5 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => navigate('/cobrancas')}>
                    <p className="text-xs font-medium text-destructive">💰 {overduePayments.length} Cobranças Vencidas</p>
                    <p className="text-[10px] text-destructive font-medium mt-0.5">
                      Total: {formatCurrency(overduePayments.reduce((a: number, p: any) => a + (p?.value || 0), 0))}
                    </p>
                  </div>
                )}
                {stats.itensEstoqueBaixo > 0 && (
                  <div className="rounded-lg border-l-2 border-l-warning bg-warning/5 p-2.5 cursor-pointer hover:bg-warning/10 transition-colors" onClick={() => navigate('/estoque')}>
                    <p className="text-xs font-medium text-warning">⚠️ {stats.itensEstoqueBaixo} Itens Estoque Baixo</p>
                  </div>
                )}
                {overdueOS.length === 0 && overduePayments.length === 0 && stats.itensEstoqueBaixo === 0 && (
                  <div className="rounded-lg border-l-2 border-l-success bg-success/5 p-2.5">
                    <p className="text-xs font-medium text-success">✅ Tudo em dia</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Cards */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-soft border-border/50 card-hover cursor-pointer" onClick={() => navigate('/financeiro')}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Performance</span></div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Clientes</span><span className="font-medium">{stats.totalClientes}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">OS Total</span><span className="font-medium">{stats.osAbertas + stats.osConcluidas}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxa Conclusão</span><span className="font-medium">{stats.osAbertas + stats.osConcluidas > 0 ? Math.round((stats.osConcluidas / (stats.osAbertas + stats.osConcluidas)) * 100) : 0}%</span></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft border-border/50 card-hover cursor-pointer" onClick={() => navigate('/estoque')}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2"><Package className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Estoque</span></div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Em Alerta</span><span className="font-medium text-destructive">{stats.itensEstoqueBaixo}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft border-border/50 card-hover cursor-pointer" onClick={() => navigate('/clientes')}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-primary" /><span className="text-xs font-medium">Clientes</span></div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">{stats.totalClientes}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View OS Dialog */}
        <Dialog open={!!viewingOS} onOpenChange={(open) => { if (!open) setViewingOS(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base">
                <span>OS {viewingOS?.numero}</span>
                {viewingOS && getStatusBadge(viewingOS.status)}
              </DialogTitle>
              <DialogDescription className="text-xs">Visualização rápida</DialogDescription>
            </DialogHeader>
            {viewingOS && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cliente</p><p className="text-sm font-medium">{viewingOS.clientes?.nome || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Equipamento</p><p className="text-sm">{TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Modelo</p><p className="text-sm">{viewingOS.modelo_equipamento || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                  <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Defeito</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setViewingOS(null); navigate('/ordens-servico'); }}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />Ver Completa
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Index;
