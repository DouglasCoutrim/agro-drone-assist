import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, Eye, Edit, Printer } from "lucide-react";

export default function OrdensServico() {
  const ordens = [
    {
      id: "OS-2024-001",
      cliente: "Fazenda São João",
      equipamento: "DJI Agras T40",
      problema: "Falha no sistema de pulverização",
      status: "Em Andamento",
      prioridade: "Alta",
      tecnico: "Carlos Silva",
      dataAbertura: "15/01/2024",
      prazoEstimado: "20/01/2024"
    },
    {
      id: "OS-2024-002", 
      cliente: "João Silva",
      equipamento: "DJI Mini 3 Pro",
      problema: "Câmera não está funcionando",
      status: "Aguardando Peça",
      prioridade: "Média",
      tecnico: "Ana Santos",
      dataAbertura: "14/01/2024",
      prazoEstimado: "25/01/2024"
    },
    {
      id: "OS-2024-003",
      cliente: "Agro Tech Ltda",
      equipamento: "Bateria TB65",
      problema: "Não carrega completamente",
      status: "Aberta",
      prioridade: "Alta",
      tecnico: "Marco Oliveira",
      dataAbertura: "13/01/2024",
      prazoEstimado: "18/01/2024"
    }
  ];

  const getStatusVariant = (status: string) => {
    switch(status) {
      case "Em Andamento": return "default";
      case "Aguardando Peça": return "secondary";
      case "Aberta": return "outline";
      case "Concluída": return "success";
      case "Cancelada": return "destructive";
      default: return "outline";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ordens de Serviço</h1>
            <p className="text-muted-foreground">
              Gerencie todas as ordens de serviço da oficina
            </p>
          </div>
          <Button className="gradient-primary shadow-medium">
            <Plus className="mr-2 h-4 w-4" />
            Nova OS
          </Button>
        </div>

        {/* Filters */}
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por OS, cliente ou equipamento..."
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

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">12</p>
                <p className="text-sm text-muted-foreground">Abertas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">8</p>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary">5</p>
                <p className="text-sm text-muted-foreground">Aguard. Peças</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">48</p>
                <p className="text-sm text-muted-foreground">Concluídas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* OS List */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Lista de Ordens de Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ordens.map((os) => (
                <div key={os.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-primary">{os.id}</p>
                        <Badge variant={os.prioridade === "Alta" ? "destructive" : "secondary"}>
                          {os.prioridade}
                        </Badge>
                      </div>
                      <p className="font-medium">{os.cliente}</p>
                      <p className="text-sm text-muted-foreground">{os.equipamento}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Problema:</p>
                      <p className="text-sm text-muted-foreground">{os.problema}</p>
                      <p className="text-xs text-muted-foreground">Técnico: {os.tecnico}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Badge variant={getStatusVariant(os.status)} className="mb-2">
                        {os.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Abertura: {os.dataAbertura}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Prazo: {os.prazoEstimado}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="mr-2 h-3 w-3" />
                        Ver
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="mr-2 h-3 w-3" />
                        Editar
                      </Button>
                      <Button size="sm" variant="outline">
                        <Printer className="mr-2 h-3 w-3" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}