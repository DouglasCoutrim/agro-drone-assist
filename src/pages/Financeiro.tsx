import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Download,
  Plus,
  CreditCard,
  Wallet,
  PiggyBank,
  Receipt
} from "lucide-react";

export default function Financeiro() {
  const transacoes = [
    {
      id: 1,
      tipo: "Receita",
      descricao: "OS-2024-001 - Reparo DJI Agras T40",
      valor: 1200.00,
      data: "15/01/2024",
      categoria: "Serviços",
      status: "Pago"
    },
    {
      id: 2,
      tipo: "Despesa",
      descricao: "Compra Bateria TB65",
      valor: -450.00,
      data: "14/01/2024",
      categoria: "Estoque",
      status: "Pago"
    },
    {
      id: 3,
      tipo: "Receita",
      descricao: "OS-2024-002 - Calibração Câmera",
      valor: 350.00,
      data: "13/01/2024",
      categoria: "Serviços",
      status: "Pendente"
    }
  ];

  const comissoes = [
    {
      tecnico: "Carlos Silva",
      osAtendidas: 8,
      valorComissao: 640.00,
      percentual: 8
    },
    {
      tecnico: "Ana Santos", 
      osAtendidas: 6,
      valorComissao: 450.00,
      percentual: 7.5
    },
    {
      tecnico: "Marco Oliveira",
      osAtendidas: 5,
      valorComissao: 375.00,
      percentual: 7.5
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">
              Controle financeiro e comissões da oficina
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button className="gradient-primary shadow-medium">
              <Plus className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* Financial Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Mensal</p>
                  <p className="text-2xl font-bold text-success">R$ 18.450</p>
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-success">+15%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <CreditCard className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesas</p>
                  <p className="text-2xl font-bold text-destructive">R$ 6.780</p>
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingDown className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">+8%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className="text-2xl font-bold text-primary">R$ 11.670</p>
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-success">+18%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <PiggyBank className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comissões</p>
                  <p className="text-2xl font-bold text-warning">R$ 1.465</p>
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-success">+5%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Transactions */}
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Transações Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transacoes.map((transacao) => (
                  <div key={transacao.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{transacao.descricao}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {transacao.categoria}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{transacao.data}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        transacao.tipo === "Receita" ? "text-success" : "text-destructive"
                      }`}>
                        {transacao.tipo === "Receita" ? "+" : ""}R$ {Math.abs(transacao.valor).toFixed(2)}
                      </p>
                      <Badge 
                        variant={transacao.status === "Pago" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {transacao.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Commissions */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Comissões do Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comissoes.map((comissao, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="space-y-2">
                      <p className="font-medium">{comissao.tecnico}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>OS Atendidas: {comissao.osAtendidas}</p>
                        <p>Percentual: {comissao.percentual}%</p>
                      </div>
                      <p className="font-bold text-primary">
                        R$ {comissao.valorComissao.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Resumo Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-4">
                <h4 className="font-medium text-success">Receitas por Categoria</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Serviços</span>
                    <span className="font-medium">R$ 15.200</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Vendas de Peças</span>
                    <span className="font-medium">R$ 2.800</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Outros</span>
                    <span className="font-medium">R$ 450</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-destructive">Despesas por Categoria</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Estoque</span>
                    <span className="font-medium">R$ 4.200</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Salários</span>
                    <span className="font-medium">R$ 2.100</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Operacionais</span>
                    <span className="font-medium">R$ 480</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-primary">Indicadores</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Margem Bruta</span>
                    <span className="font-medium">63.2%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Ticket Médio</span>
                    <span className="font-medium">R$ 384</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>ROI</span>
                    <span className="font-medium">172%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}