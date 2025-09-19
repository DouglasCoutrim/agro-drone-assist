import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, AlertTriangle, Package, TrendingDown, TrendingUp } from "lucide-react";

export default function Estoque() {
  const itens = [
    {
      id: "EST-001",
      codigo: "BAT-TB65-001",
      nome: "Bateria TB65 - DJI Agras",
      categoria: "Baterias",
      fornecedor: "DJI",
      estoque: 2,
      minimo: 5,
      custo: 2800.00,
      preco: 3500.00,
      status: "Baixo"
    },
    {
      id: "EST-002",
      codigo: "HEL-T40-SET",
      nome: "Jogo Hélices DJI Agras T40",
      categoria: "Hélices",
      fornecedor: "DJI",
      estoque: 8,
      minimo: 3,
      custo: 350.00,
      preco: 450.00,
      status: "Ok"
    },
    {
      id: "EST-003",
      codigo: "CAM-MINI3-001",
      nome: "Câmera DJI Mini 3 Pro",
      categoria: "Câmeras",
      fornecedor: "DJI",
      estoque: 3,
      minimo: 2,
      custo: 1200.00,
      preco: 1600.00,
      status: "Atenção"
    },
    {
      id: "EST-004",
      codigo: "MOT-AIR2S-001",
      nome: "Motor DJI Air 2S",
      categoria: "Motores",
      fornecedor: "DJI",
      estoque: 15,
      minimo: 5,
      custo: 450.00,
      preco: 680.00,
      status: "Ok"
    }
  ];

  const getStatusVariant = (status: string) => {
    switch(status) {
      case "Baixo": return "destructive";
      case "Atenção": return "warning";
      case "Ok": return "success";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "Baixo": return <TrendingDown className="h-4 w-4" />;
      case "Atenção": return <AlertTriangle className="h-4 w-4" />;
      case "Ok": return <TrendingUp className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Controle de Estoque</h1>
            <p className="text-muted-foreground">
              Gerencie peças, componentes e produtos
            </p>
          </div>
          <Button className="gradient-primary shadow-medium">
            <Plus className="mr-2 h-4 w-4" />
            Novo Item
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Itens</p>
                  <p className="text-2xl font-bold">247</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Baixo Estoque</p>
                  <p className="text-2xl font-bold text-destructive">5</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">R$ 125.4K</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Categorias</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, nome ou categoria..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Inventário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {itens.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    <div className="space-y-1">
                      <p className="font-medium">{item.nome}</p>
                      <p className="text-sm text-muted-foreground">{item.codigo}</p>
                      <Badge variant="outline">{item.categoria}</Badge>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Fornecedor</p>
                      <p className="font-medium">{item.fornecedor}</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Estoque</p>
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-xl font-bold">{item.estoque}</p>
                        <Badge variant={getStatusVariant(item.status)} className="flex items-center gap-1">
                          {getStatusIcon(item.status)}
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Min: {item.minimo}</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Custo</p>
                      <p className="font-medium">R$ {item.custo.toFixed(2)}</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Preço Venda</p>
                      <p className="font-medium text-success">R$ {item.preco.toFixed(2)}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Editar
                      </Button>
                      <Button size="sm" variant="outline">
                        Movimentar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Últimas Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Saída - Bateria TB65</p>
                    <p className="text-sm text-muted-foreground">OS-2024-003</p>
                  </div>
                  <Badge variant="destructive">-1</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Entrada - Hélices T40</p>
                    <p className="text-sm text-muted-foreground">Compra</p>
                  </div>
                  <Badge variant="success">+5</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Saída - Câmera Mini 3</p>
                    <p className="text-sm text-muted-foreground">OS-2024-002</p>
                  </div>
                  <Badge variant="destructive">-1</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Alertas de Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border-l-4 border-l-destructive">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Bateria TB65</p>
                    <p className="text-sm text-muted-foreground">Apenas 2 unidades restantes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border-l-4 border-l-warning">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium text-warning">Câmera Mini 3</p>
                    <p className="text-sm text-muted-foreground">Próximo do mínimo</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}