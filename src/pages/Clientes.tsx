import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Phone, 
  Mail, 
  MapPin,
  User,
  Building,
  Calendar,
  FileText
} from "lucide-react";

export default function Clientes() {
  const clientes = [
    {
      id: 1,
      nome: "Fazenda São João",
      tipo: "Pessoa Jurídica",
      documento: "12.345.678/0001-90",
      telefone: "(11) 99999-1234",
      email: "contato@fazendaosjoao.com.br",
      endereco: "Rua das Culturas, 123 - Rural",
      cidade: "Ribeirão Preto - SP",
      totalOS: 12,
      ultimaOS: "15/01/2024",
      status: "Ativo",
      categoria: "Premium"
    },
    {
      id: 2,
      nome: "João Silva",
      tipo: "Pessoa Física",
      documento: "123.456.789-00",
      telefone: "(11) 98888-5678",
      email: "joao.silva@email.com",
      endereco: "Av. Principal, 456 - Centro",
      cidade: "São Paulo - SP",
      totalOS: 3,
      ultimaOS: "14/01/2024",
      status: "Ativo",
      categoria: "Regular"
    },
    {
      id: 3,
      nome: "Agro Tech Ltda",
      tipo: "Pessoa Jurídica",
      documento: "98.765.432/0001-10",
      telefone: "(11) 97777-9012",
      email: "suporte@agrotech.com.br",
      endereco: "Rod. Industrial, km 15",
      cidade: "Campinas - SP",
      totalOS: 25,
      ultimaOS: "13/01/2024",
      status: "Ativo",
      categoria: "VIP"
    },
    {
      id: 4,
      nome: "Maria Santos",
      tipo: "Pessoa Física",
      documento: "987.654.321-00",
      telefone: "(11) 96666-3456",
      email: "maria.santos@email.com",
      endereco: "Rua das Flores, 789",
      cidade: "Sorocaba - SP",
      totalOS: 1,
      ultimaOS: "10/12/2023",
      status: "Inativo",
      categoria: "Regular"
    }
  ];

  const getCategoriaVariant = (categoria: string) => {
    switch(categoria) {
      case "VIP": return "default";
      case "Premium": return "secondary";
      case "Regular": return "outline";
      default: return "outline";
    }
  };

  const getStatusVariant = (status: string) => {
    return status === "Ativo" ? "default" : "secondary";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">
              Gerencie o cadastro de clientes da oficina
            </p>
          </div>
          <Button className="gradient-primary shadow-medium">
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        {/* Filters */}
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, documento ou e-mail..."
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
                <p className="text-2xl font-bold text-primary">127</p>
                <p className="text-sm text-muted-foreground">Total de Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">113</p>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">8</p>
                <p className="text-sm text-muted-foreground">Novos este Mês</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-secondary">89%</p>
                <p className="text-sm text-muted-foreground">Taxa Retenção</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients List */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientes.map((cliente) => (
                <div key={cliente.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-full bg-primary/10">
                          {cliente.tipo === "Pessoa Jurídica" ? 
                            <Building className="h-4 w-4 text-primary" /> : 
                            <User className="h-4 w-4 text-primary" />
                          }
                        </div>
                        <div>
                          <p className="font-bold">{cliente.nome}</p>
                          <p className="text-xs text-muted-foreground">{cliente.documento}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getCategoriaVariant(cliente.categoria)}>
                          {cliente.categoria}
                        </Badge>
                        <Badge variant={getStatusVariant(cliente.status)}>
                          {cliente.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{cliente.telefone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{cliente.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{cliente.cidade}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{cliente.totalOS} OS realizadas</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Última OS: {cliente.ultimaOS}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline">
                        Ver Perfil
                      </Button>
                      <Button size="sm" variant="outline">
                        Editar
                      </Button>
                      <Button size="sm" variant="outline">
                        Histórico OS
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">VIP</span>
                  <span className="font-medium">12 clientes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Premium</span>
                  <span className="font-medium">35 clientes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Regular</span>
                  <span className="font-medium">80 clientes</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Top Clientes (OS)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Agro Tech Ltda</span>
                  <span className="font-medium">25 OS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Fazenda São João</span>
                  <span className="font-medium">12 OS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Rural Drones SA</span>
                  <span className="font-medium">8 OS</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Análise Geográfica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">São Paulo - SP</span>
                  <span className="font-medium">45 clientes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Ribeirão Preto - SP</span>
                  <span className="font-medium">28 clientes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Campinas - SP</span>
                  <span className="font-medium">21 clientes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}