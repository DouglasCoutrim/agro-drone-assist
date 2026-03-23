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
    <div className={cn("flex h-full w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border", className)}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src={logo} alt="Volt Control" className="h-7 w-auto" />
        <div>
          <h2 className="text-sm font-bold text-primary leading-none tracking-tight">VoltControl</h2>
          <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">Gestão de Oficina</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Button key={item.href} variant="ghost" className={cn(
              "w-full justify-start gap-2.5 h-8 text-xs font-normal text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md px-2.5 transition-all duration-150",
              isActive && "bg-sidebar-accent text-primary font-medium border-l-2 border-primary rounded-l-none"
            )} asChild>
              <Link to={item.href}>
                <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
                {item.title}
              </Link>
            </Button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/15">
            <Zap className="h-3 w-3 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-sidebar-foreground/80">Sistema Online</p>
            <p className="text-[9px] text-sidebar-foreground/30">v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
