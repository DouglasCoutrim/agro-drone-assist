import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Palette,
  Database,
  Mail,
  Smartphone,
  Globe,
  Save,
  Key,
  Users,
  AlertTriangle,
  Info
} from "lucide-react";

export default function Configuracoes() {
  const usuarios = [
    {
      id: 1,
      nome: "Admin Sistema",
      email: "admin@djiservice.com.br",
      perfil: "Administrador",
      status: "Ativo",
      ultimoAcesso: "15/01/2024 14:30"
    },
    {
      id: 2,
      nome: "Carlos Silva",
      email: "carlos@djiservice.com.br", 
      perfil: "Técnico",
      status: "Ativo",
      ultimoAcesso: "15/01/2024 13:45"
    },
    {
      id: 3,
      nome: "Ana Santos",
      email: "ana@djiservice.com.br",
      perfil: "Técnico",
      status: "Ativo",
      ultimoAcesso: "15/01/2024 12:15"
    }
  ];

  const getPerfilVariant = (perfil: string) => {
    switch(perfil) {
      case "Administrador": return "default";
      case "Técnico": return "secondary";
      case "Consulta": return "outline";
      default: return "outline";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">
              Gerencie as configurações do sistema e usuários
            </p>
          </div>
          <Button className="gradient-primary shadow-medium">
            <Save className="mr-2 h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* System Settings */}
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Info */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Informações da Empresa
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome da Empresa</label>
                    <Input defaultValue="DJI Service - Oficina Autorizada" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CNPJ</label>
                    <Input defaultValue="12.345.678/0001-90" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Telefone</label>
                    <Input defaultValue="(11) 99999-0000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">E-mail</label>
                    <Input defaultValue="contato@djiservice.com.br" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço</label>
                  <Input defaultValue="Rua das Oficinas, 123 - Centro - São Paulo - SP" />
                </div>
              </div>

              {/* Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notificações
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Alertas de Estoque Baixo</p>
                      <p className="text-sm text-muted-foreground">Receber notificações quando itens atingirem o nível mínimo</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Notificações por E-mail</p>
                      <p className="text-sm text-muted-foreground">Enviar resumos diários por e-mail</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">SMS de OS Urgentes</p>
                      <p className="text-sm text-muted-foreground">Enviar SMS para OS com prioridade alta</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Aparência
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Modo Escuro</p>
                      <p className="text-sm text-muted-foreground">Ativar tema escuro automaticamente</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Idioma do Sistema</label>
                    <select className="w-full p-2 border border-border rounded-md">
                      <option value="pt-br">Português (Brasil)</option>
                      <option value="en-us">English (US)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Integration */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Integrações
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">API REST</p>
                        <p className="text-sm text-muted-foreground">Acesso à API para integrações externas</p>
                      </div>
                    </div>
                    <Badge variant="default">Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-warning" />
                      <div>
                        <p className="font-medium">n8n Webhook</p>
                        <p className="text-sm text-muted-foreground">Automação de processos</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Configurar</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <Key className="mr-2 h-4 w-4" />
                  Alterar Senha
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="mr-2 h-4 w-4" />
                  Backup do Sistema
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Database className="mr-2 h-4 w-4" />
                  Logs do Sistema
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Informações do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Versão</span>
                  <span className="font-medium">v1.0.0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Último Backup</span>
                  <span className="font-medium">14/01/2024</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Status do Banco</span>
                  <Badge variant="default" className="text-xs">Online</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Usuários Ativos</span>
                  <span className="font-medium">3</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* User Management */}
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciamento de Usuários
            </CardTitle>
            <Button size="sm" className="gradient-primary">
              <User className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {usuarios.map((usuario) => (
                <div key={usuario.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">{usuario.nome}</p>
                      <p className="text-sm text-muted-foreground">{usuario.email}</p>
                      <p className="text-xs text-muted-foreground">Último acesso: {usuario.ultimoAcesso}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getPerfilVariant(usuario.perfil)}>
                      {usuario.perfil}
                    </Badge>
                    <Badge variant={usuario.status === "Ativo" ? "default" : "secondary"}>
                      {usuario.status}
                    </Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Editar
                      </Button>
                      {usuario.perfil !== "Administrador" && (
                        <Button size="sm" variant="outline">
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      )}
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