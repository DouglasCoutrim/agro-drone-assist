import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Download, 
  Calendar, 
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
  Users
} from "lucide-react";

export default function Relatorios() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">
              Análises e relatórios gerenciais da oficina
            </p>
          </div>
          <Button className="gradient-primary shadow-medium">
            <Download className="mr-2 h-4 w-4" />
            Exportar Relatórios
          </Button>
        </div>

        {/* Report Categories */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Ordens de Serviço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Relatórios completos sobre desempenho e status das OS
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  OS por período
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Tempo médio de reparo
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Taxa de reincidência
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-success" />
                Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Análises de faturamento, custos e rentabilidade
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Faturamento mensal
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Margem de lucro
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Comissões técnicos
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Estoque
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Controle de inventário e movimentações
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Inventário atual
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Movimentações
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Itens críticos
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Análise do relacionamento com clientes
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Clientes ativos
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Histórico de atendimento
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Satisfação
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-warning" />
                Produtividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Eficiência da equipe e processos
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Por técnico
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Por tipo de serviço
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Capacidade instalada
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-success" />
                Tendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Análise de tendências e previsões
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Sazonalidade
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Previsão demanda
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Análise de falhas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Dashboard */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dashboard Rápido - Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-2xl font-bold text-primary">48</p>
                <p className="text-sm text-muted-foreground">OS Concluídas</p>
                <p className="text-xs text-success">+12% vs mês anterior</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-success/5">
                <p className="text-2xl font-bold text-success">R$ 24.580</p>
                <p className="text-sm text-muted-foreground">Faturamento</p>
                <p className="text-xs text-success">+15% vs mês anterior</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-warning/5">
                <p className="text-2xl font-bold text-warning">4.2</p>
                <p className="text-sm text-muted-foreground">Tempo Médio (dias)</p>
                <p className="text-xs text-success">-0.8 vs mês anterior</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-2xl font-bold text-primary">98.5%</p>
                <p className="text-sm text-muted-foreground">Taxa Sucesso</p>
                <p className="text-xs text-success">+2.1% vs mês anterior</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Reports */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Relatórios Agendados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Relatório Mensal de Faturamento</p>
                  <p className="text-sm text-muted-foreground">Próxima execução: 01/02/2024</p>
                </div>
                <Button variant="outline" size="sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  Configurar
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Inventário Semanal</p>
                  <p className="text-sm text-muted-foreground">Próxima execução: Toda segunda-feira</p>
                </div>
                <Button variant="outline" size="sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  Configurar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}