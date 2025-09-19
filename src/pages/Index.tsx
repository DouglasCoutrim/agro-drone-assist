import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Package, 
  DollarSign, 
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  Users
} from "lucide-react";

const Index = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Bem-vindo ao sistema de gestão da oficina DJI
            </p>
          </div>
          <Button className="gradient-primary shadow-medium">
            <FileText className="mr-2 h-4 w-4" />
            Nova OS
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="OS Abertas"
            value="12"
            change={{ value: 8, trend: "up" }}
            icon={FileText}
            variant="warning"
          />
          <StatsCard
            title="OS Concluídas (Mês)"
            value="48"
            change={{ value: 12, trend: "up" }}
            icon={CheckCircle}
            variant="success"
          />
          <StatsCard
            title="Itens Baixo Estoque"
            value="5"
            icon={AlertTriangle}
            variant="destructive"
          />
          <StatsCard
            title="Faturamento (Mês)"
            value="R$ 24.580"
            change={{ value: 15, trend: "up" }}
            icon={DollarSign}
            variant="success"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* OS Recentes */}
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Ordens de Serviço Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    id: "OS-2024-001",
                    cliente: "Fazenda São João",
                    equipamento: "DJI Agras T40",
                    status: "Em Andamento",
                    prioridade: "Alta"
                  },
                  {
                    id: "OS-2024-002", 
                    cliente: "João Silva",
                    equipamento: "DJI Mini 3 Pro",
                    status: "Aguardando Peça",
                    prioridade: "Média"
                  },
                  {
                    id: "OS-2024-003",
                    cliente: "Agro Tech Ltda",
                    equipamento: "Bateria TB65",
                    status: "Aberta",
                    prioridade: "Alta"
                  }
                ].map((os) => (
                  <div key={os.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{os.id}</p>
                      <p className="text-sm text-muted-foreground">{os.cliente}</p>
                      <p className="text-xs text-muted-foreground">{os.equipamento}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge 
                        variant={
                          os.status === "Em Andamento" ? "default" :
                          os.status === "Aguardando Peça" ? "secondary" : 
                          "outline"
                        }
                        className="status-badge"
                      >
                        {os.status}
                      </Badge>
                      <Badge 
                        variant={os.prioridade === "Alta" ? "destructive" : "secondary"}
                      >
                        {os.prioridade}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alertas e Notificações */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alertas do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border-l-4 border-l-warning bg-warning/5 p-4">
                  <p className="font-medium text-warning">Estoque Baixo</p>
                  <p className="text-sm text-muted-foreground">
                    5 itens abaixo do nível mínimo
                  </p>
                </div>
                
                <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-4">
                  <p className="font-medium text-primary">OS Pendentes</p>
                  <p className="text-sm text-muted-foreground">
                    3 OS aguardando atualização há mais de 2 dias
                  </p>
                </div>
                
                <div className="rounded-lg border-l-4 border-l-success bg-success/5 p-4">
                  <p className="font-medium text-success">Meta Mensal</p>
                  <p className="text-sm text-muted-foreground">
                    85% da meta de faturamento atingida
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Tempo Médio de Reparo</span>
                  <span className="font-medium">4.2 dias</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Taxa de Reincidência</span>
                  <span className="font-medium">2.1%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Satisfação Cliente</span>
                  <span className="font-medium">4.8/5</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Estoque Rápido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Baterias TB65</span>
                  <span className="font-medium text-destructive">2 unid.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Hélices T40</span>
                  <span className="font-medium">8 jogos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Câmeras Mini 3</span>
                  <span className="font-medium text-warning">3 unid.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Total de Clientes</span>
                  <span className="font-medium">127</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Novos este Mês</span>
                  <span className="font-medium">8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Clientes Recorrentes</span>
                  <span className="font-medium">89%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
