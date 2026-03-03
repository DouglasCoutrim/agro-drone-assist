import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FileText, 
  Package, 
  BarChart3, 
  DollarSign, 
  Settings, 
  Users,
  Plane,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const { role } = useAuth();

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Ordens de Serviço", icon: FileText, href: "/ordens-servico", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Estoque", icon: Package, href: "/estoque", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Relatórios", icon: BarChart3, href: "/relatorios", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Financeiro", icon: DollarSign, href: "/financeiro", roles: ['admin', 'tecnico'] },
    { title: "Cobranças Asaas", icon: CreditCard, href: "/cobrancas", roles: ['admin', 'tecnico'] },
    { title: "Clientes", icon: Users, href: "/clientes", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Configurações", icon: Settings, href: "/configuracoes", roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    role && item.roles.includes(role)
  );

  return (
    <div className={cn(
      "flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground",
      className
    )}>
      <div className="flex items-center gap-3 border-b border-sidebar-border p-4">
        <img src={logo} alt="Ares Agrotec" className="h-10 w-auto" />
        <div>
          <h2 className="text-lg font-bold text-primary">Ares Agrotec</h2>
          <p className="text-xs text-sidebar-foreground/60">Gestão de Oficina</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {filteredMenuItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-11 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                isActive && "bg-sidebar-accent text-primary font-semibold"
              )}
              asChild
            >
              <Link to={item.href}>
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {item.title}
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Plane className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-sidebar-foreground">Sistema Online</p>
            <p className="text-xs text-sidebar-foreground/60">v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
