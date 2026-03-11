import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
      const { data: recentOSData } = await supabase.from('ordens_servico').select('*, clientes (nome)').order('created_at', { ascending: false }).limit(5);
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
      const { data: receitas } = await supabase.from('financeiro').select('valor').eq('tipo', 'receita').gte('data_transacao', startOfMonth.toISOString());
      const faturamentoMes = receitas?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;
      setStats({ osAbertas: osAbertas?.length || 0, osConcluidas: osConcluidas?.length || 0, itensEstoqueBaixo, totalClientes: totalClientes || 0, faturamentoMes });
      setRecentOS(recentOSData || []);
    } catch (error) { console.error('Error fetching dashboard data:', error); } finally { setLoading(false); }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPrioridadeBadge = (prioridade: string) => {
    if (prioridade === 'alta') return <Badge variant="destructive">Alta</Badge>;
    if (prioridade === 'media') return <Badge variant="secondary">Média</Badge>;
    return <Badge variant="outline">Baixa</Badge>;
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
             <h1 className="text-3xl font-bold flex items-center gap-2">
               <Zap className="h-8 w-8 text-primary" />Dashboard
             </h1>
             <p className="text-muted-foreground">Bem-vindo ao Volt Control - Gestão de Oficina</p>
          </div>
          <Button className="gradient-primary shadow-medium" onClick={() => navigate('/ordens-servico')}>
            <Plus className="mr-2 h-4 w-4" />Nova OS
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="OS Abertas" value={stats.osAbertas.toString()} icon={FileText} variant="warning" onClick={() => navigate('/ordens-servico')} />
          <StatsCard title="OS Concluídas" value={stats.osConcluidas.toString()} icon={CheckCircle} variant="success" onClick={() => navigate('/ordens-servico')} />
          <StatsCard title="Itens Baixo Estoque" value={stats.itensEstoqueBaixo.toString()} icon={AlertTriangle} variant="destructive" onClick={() => navigate('/estoque')} />
          <StatsCard title="Faturamento (Mês)" value={formatCurrency(stats.faturamentoMes)} icon={DollarSign} variant="success" onClick={() => navigate('/financeiro')} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft card-hover">
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Ordens de Serviço Recentes</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
              ) : recentOS.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nenhuma ordem de serviço encontrada</p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate('/ordens-servico')}>Criar primeira OS</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOS.map((os) => (
                    <div key={os.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setViewingOS(os)}>
                      <div className="space-y-1">
                        <p className="font-medium text-primary">{os.numero}</p>
                        <p className="text-sm text-muted-foreground">{os.clientes?.nome}</p>
                        <p className="text-xs text-muted-foreground">{TIPO_EQUIPAMENTO[os.tipo_equipamento] || os.tipo_equipamento}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">{getStatusBadge(os.status)}{getPrioridadeBadge(os.prioridade)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft card-hover">
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />Alertas do Sistema</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.itensEstoqueBaixo > 0 && (
                  <div className="rounded-lg border-l-4 border-l-warning bg-warning/5 p-4 cursor-pointer hover:bg-warning/10 transition-colors" onClick={() => navigate('/estoque')}>
                    <p className="font-medium text-warning">Estoque Baixo</p>
                    <p className="text-sm text-muted-foreground">{stats.itensEstoqueBaixo} itens abaixo do nível mínimo</p>
                  </div>
                )}
                {stats.osAbertas > 0 && (
                  <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-4 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => navigate('/ordens-servico')}>
                    <p className="font-medium text-primary">OS Pendentes</p>
                    <p className="text-sm text-muted-foreground">{stats.osAbertas} OS aguardando atendimento</p>
                  </div>
                )}
                <div className="rounded-lg border-l-4 border-l-success bg-success/5 p-4">
                  <p className="font-medium text-success">Sistema Operacional</p>
                  <p className="text-sm text-muted-foreground">Todos os serviços funcionando normalmente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-soft card-hover cursor-pointer" onClick={() => navigate('/financeiro')}>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm">Total de Clientes</span><span className="font-medium">{stats.totalClientes}</span></div>
                <div className="flex justify-between"><span className="text-sm">OS este mês</span><span className="font-medium">{stats.osAbertas + stats.osConcluidas}</span></div>
                <div className="flex justify-between"><span className="text-sm">Taxa de Conclusão</span><span className="font-medium">{stats.osAbertas + stats.osConcluidas > 0 ? Math.round((stats.osConcluidas / (stats.osAbertas + stats.osConcluidas)) * 100) : 0}%</span></div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover cursor-pointer" onClick={() => navigate('/estoque')}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Estoque Rápido</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm">Itens em Alerta</span><span className="font-medium text-destructive">{stats.itensEstoqueBaixo}</span></div>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); navigate('/estoque'); }}>Ver Estoque Completo</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft card-hover cursor-pointer" onClick={() => navigate('/clientes')}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Clientes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm">Total de Clientes</span><span className="font-medium">{stats.totalClientes}</span></div>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); navigate('/clientes'); }}>Ver Clientes</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View OS Dialog */}
        <Dialog open={!!viewingOS} onOpenChange={(open) => { if (!open) setViewingOS(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>OS {viewingOS?.numero}</span>
                {viewingOS && getStatusBadge(viewingOS.status)}
              </DialogTitle>
              <DialogDescription>Visualização rápida da OS</DialogDescription>
            </DialogHeader>
            {viewingOS && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{viewingOS.clientes?.nome || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Equipamento</p><p className="font-medium">{TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento}</p></div>
                  <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-medium">{viewingOS.modelo_equipamento || "-"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Prioridade</p>{getPrioridadeBadge(viewingOS.prioridade)}</div>
                  <div><p className="text-xs text-muted-foreground">Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Orçamento</p><p className="font-medium text-primary">{viewingOS.valor_orcamento ? formatCurrency(viewingOS.valor_orcamento) : "-"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Defeito Relatado</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => { setViewingOS(null); navigate('/ordens-servico'); }}>
                    <Eye className="mr-2 h-4 w-4" />Ver Completa
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
