import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, FileText, Package, BarChart3, DollarSign, Settings, Users, Zap, CreditCard, UsersRound, Building2, ClipboardList, Route
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

interface SidebarProps { className?: string; }

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const { role } = useAuth();

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Ordens de Serviço", icon: FileText, href: "/ordens-servico", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Orçamentos", icon: ClipboardList, href: "/orcamentos", roles: ['admin', 'tecnico'] },
    { title: "Estoque", icon: Package, href: "/estoque", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Relatórios", icon: BarChart3, href: "/relatorios", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Financeiro", icon: DollarSign, href: "/financeiro", roles: ['admin', 'tecnico'] },
    { title: "Cobranças", icon: CreditCard, href: "/cobrancas", roles: ['admin', 'tecnico'] },
    { title: "Rotas", icon: Route, href: "/rotas", roles: ['admin', 'tecnico'] },
    { title: "Clientes", icon: Users, href: "/clientes", roles: ['admin', 'tecnico', 'consulta'] },
    { title: "Equipe", icon: UsersRound, href: "/equipe", roles: ['admin'] },
    { title: "Empresa", icon: Building2, href: "/empresa", roles: ['admin'] },
    { title: "Configurações", icon: Settings, href: "/configuracoes", roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => role && item.roles.includes(role));

  return (
    <div className={cn("flex h-full w-56 flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-3">
        <img src={logo} alt="Volt Control" className="h-8 w-auto" />
        <div>
          <h2 className="text-sm font-bold text-primary leading-tight">VoltControl</h2>
          <p className="text-[10px] text-sidebar-foreground/50">Gestão de Oficina</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Button key={item.href} variant="ghost" className={cn(
              "w-full justify-start gap-2.5 h-9 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent px-2.5",
              isActive && "bg-sidebar-accent text-primary font-semibold"
            )} asChild>
              <Link to={item.href}>
                <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                {item.title}
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/20"><Zap className="h-3 w-3 text-primary" /></div>
          <div>
            <p className="text-[11px] font-medium text-sidebar-foreground">Online</p>
            <p className="text-[9px] text-sidebar-foreground/40">v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
