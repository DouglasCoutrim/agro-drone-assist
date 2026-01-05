import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Download, 
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  Package,
  Zap,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Relatorios() {
  const [stats, setStats] = useState({
    osConcluidas: 0,
    faturamento: 0,
    totalClientes: 0,
    totalItensEstoque: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [osRes, finRes, clientesRes, estoqueRes] = await Promise.all([
        supabase
          .from('ordens_servico')
          .select('id', { count: 'exact' })
          .in('status', ['concluida', 'entregue'])
          .gte('created_at', startOfMonth.toISOString()),
        supabase
          .from('financeiro')
          .select('valor')
          .eq('tipo', 'receita')
          .gte('data_transacao', startOfMonth.toISOString()),
        supabase
          .from('clientes')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('itens_estoque')
          .select('*', { count: 'exact', head: true })
      ]);

      const faturamento = finRes.data?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

      setStats({
        osConcluidas: osRes.data?.length || 0,
        faturamento,
        totalClientes: clientesRes.count || 0,
        totalItensEstoque: estoqueRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const reportCategories = [
    {
      title: "Ordens de Serviço",
      icon: FileText,
      color: "text-primary",
      description: "Relatórios sobre desempenho e status das OS",
      reports: ["OS por período", "Tempo médio de reparo", "Taxa de reincidência"]
    },
    {
      title: "Financeiro",
      icon: DollarSign,
      color: "text-success",
      description: "Análises de faturamento, custos e rentabilidade",
      reports: ["Faturamento mensal", "Margem de lucro", "Comissões técnicos"]
    },
    {
      title: "Estoque",
      icon: Package,
      color: "text-primary",
      description: "Controle de inventário e movimentações",
      reports: ["Inventário atual", "Movimentações", "Itens críticos"]
    },
    {
      title: "Clientes",
      icon: Users,
      color: "text-primary",
      description: "Análise do relacionamento com clientes",
      reports: ["Clientes ativos", "Histórico de atendimento", "Satisfação"]
    },
    {
      title: "Produtividade",
      icon: Clock,
      color: "text-warning",
      description: "Eficiência da equipe e processos",
      reports: ["Por técnico", "Por tipo de serviço", "Capacidade instalada"]
    },
    {
      title: "Tendências",
      icon: TrendingUp,
      color: "text-success",
      description: "Análise de tendências e previsões",
      reports: ["Sazonalidade", "Previsão demanda", "Análise de falhas"]
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Relatórios
            </h1>
            <p className="text-muted-foreground">
              Análises e relatórios gerenciais
            </p>
          </div>
          <Button className="gradient-primary shadow-medium">
            <Download className="mr-2 h-4 w-4" />
            Exportar Relatórios
          </Button>
        </div>

        {/* Quick Stats Dashboard */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Dashboard Rápido - Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <p className="text-2xl font-bold text-primary">{stats.osConcluidas}</p>
                  <p className="text-sm text-muted-foreground">OS Concluídas</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-success/5">
                  <p className="text-2xl font-bold text-success">{formatCurrency(stats.faturamento)}</p>
                  <p className="text-sm text-muted-foreground">Faturamento</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-warning/5">
                  <p className="text-2xl font-bold text-warning">{stats.totalClientes}</p>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <p className="text-2xl font-bold text-primary">{stats.totalItensEstoque}</p>
                  <p className="text-sm text-muted-foreground">Itens em Estoque</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Categories */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reportCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Card key={index} className="shadow-soft card-hover cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className={`h-5 w-5 ${category.color}`} />
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {category.description}
                  </p>
                  <div className="space-y-2">
                    {category.reports.map((report, idx) => (
                      <Button key={idx} variant="outline" size="sm" className="w-full justify-start">
                        {report}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
        <Card className="shadow-soft border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Sistema de Relatórios</h3>
                <p className="text-sm text-muted-foreground">
                  Os relatórios são gerados com base nos dados reais do sistema. 
                  Clique em qualquer relatório para visualizar informações detalhadas 
                  e exportar em PDF ou Excel.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
