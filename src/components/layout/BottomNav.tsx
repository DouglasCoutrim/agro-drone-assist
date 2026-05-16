import { LayoutDashboard, FileText, Users, Package, MoreHorizontal } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, BarChart3, Settings, CreditCard, ClipboardList, Route, UsersRound, Building2
} from "lucide-react";

const mainItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ordens-servico", icon: FileText, label: "Ordens" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/estoque", icon: Package, label: "Estoque" },
];

const moreItems = [
  { to: "/financeiro", icon: DollarSign, label: "Financeiro", roles: ["admin", "tecnico"] },
  { to: "/cobrancas", icon: CreditCard, label: "Cobranças", roles: ["admin", "tecnico"] },
  { to: "/orcamentos", icon: ClipboardList, label: "Orçamentos", roles: ["admin", "tecnico"] },
  { to: "/rotas", icon: Route, label: "Rotas", roles: ["admin", "tecnico"] },
  { to: "/relatorios", icon: BarChart3, label: "Relatórios", roles: ["admin", "tecnico", "consulta"] },
  { to: "/equipe", icon: UsersRound, label: "Equipe", roles: ["admin"] },
  { to: "/empresa", icon: Building2, label: "Empresa", roles: ["admin"] },
  { to: "/configuracoes", icon: Settings, label: "Configurações", roles: ["admin"] },
];

export function BottomNav() {
  const location = useLocation();
  const { role } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredMore = moreItems.filter(item => role && item.roles.includes(role));

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[150] lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-[var(--bottom-nav-height)] left-0 right-0 bg-card border-t border-border rounded-t-xl p-4 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
            <div className="grid grid-cols-4 gap-3">
              {filteredMore.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-none">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[var(--bottom-nav-height)] bg-card border-t border-border flex items-center justify-around px-2 z-[100] lg:hidden" style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.06)" }}>
        {mainItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className={cn(
                "text-[10px] leading-none",
                isActive ? "font-semibold text-primary" : "font-medium"
              )}>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all",
            drawerOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Mais</span>
        </button>
      </nav>
    </>
  );
}
