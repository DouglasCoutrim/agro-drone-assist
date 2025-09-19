import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FileText, 
  Package, 
  BarChart3, 
  DollarSign, 
  Settings, 
  Users,
  Wrench,
  Battery,
  Plane
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "react-router-dom";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    title: "Ordens de Serviço",
    icon: FileText,
    href: "/ordens-servico",
  },
  {
    title: "Estoque",
    icon: Package,
    href: "/estoque",
  },
  {
    title: "Relatórios",
    icon: BarChart3,
    href: "/relatorios",
  },
  {
    title: "Financeiro",
    icon: DollarSign,
    href: "/financeiro",
  },
  {
    title: "Clientes",
    icon: Users,
    href: "/clientes",
  },
  {
    title: "Configurações",
    icon: Settings,
    href: "/configuracoes",
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();

  return (
    <div className={cn(
      "flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground",
      className
    )}>
      {/* Logo/Header */}
      <div className="flex items-center gap-2 border-b border-sidebar-border p-6">
        <div className="flex items-center gap-2">
          <Plane className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h2 className="text-lg font-bold">DJI Service</h2>
            <p className="text-xs text-sidebar-foreground/60">Oficina Autorizada</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-11",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              asChild
            >
              <Link to={item.href}>
                <Icon className="h-5 w-5" />
                {item.title}
              </Link>
            </Button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Battery className="h-5 w-5 text-success" />
          <div className="text-sm">
            <p className="font-medium">Sistema Online</p>
            <p className="text-xs text-sidebar-foreground/60">v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}