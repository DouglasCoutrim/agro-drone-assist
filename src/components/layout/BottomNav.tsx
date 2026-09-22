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
  const { roles } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredMore = moreItems.filter(item => roles.some((assignedRole) => item.roles.includes(assignedRole)));

  return (
    <>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[150] lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div
            className="absolute bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] left-0 right-0 bg-card border-t border-border rounded-t-[2.5rem] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom duration-300 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-muted mx-auto mb-6" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 px-2">Mais Opções</h3>
            <div className="grid grid-cols-3 gap-4">
              {filteredMore.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-95",
                      isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-foreground hover:bg-muted border border-transparent"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl", isActive ? "bg-primary/20" : "bg-muted")}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-[11px] font-bold leading-none text-center">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[var(--bottom-nav-height)] pb-[env(safe-area-inset-bottom)] bg-card/90 backdrop-blur-xl border-t border-border flex items-center justify-around px-4 z-[100] lg:hidden w-full transition-all duration-300 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        {mainItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex-1 flex flex-col items-center gap-1.5 py-2 transition-all active:scale-90",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-full shadow-[0_0_12px_rgba(22,163,74,0.6)]" />}
              <Icon className={cn("h-6 w-6 transition-transform", isActive && "scale-110")} />
              <span className={cn(
                "text-[10px] leading-none tracking-tight",
                isActive ? "font-bold" : "font-medium"
              )}>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 py-2 transition-all active:scale-90",
            drawerOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className={cn("h-6 w-6 transition-transform", drawerOpen && "scale-110 rotate-90")} />
          <span className="text-[10px] font-medium leading-none tracking-tight">Mais</span>
        </button>
      </nav>
    </>
  );
}
