import { LayoutDashboard, FileText, Users, Package, MoreHorizontal } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { sectionsForRoles } from "./navConfig";
import {
  DollarSign, BarChart3, Settings, CreditCard, ClipboardList, UsersRound, Building2
} from "lucide-react";

const mainItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ordens-servico", icon: FileText, label: "Ordens" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/estoque", icon: Package, label: "Estoque" },
];

export function BottomNav() {
  const location = useLocation();
  const { roles } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sections = sectionsForRoles(roles);

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
            <div className="max-h-[65vh] overflow-y-auto space-y-4">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{section.title}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setDrawerOpen(false)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95",
                            isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-foreground hover:bg-muted border border-transparent"
                          )}
                        >
                          <div className={cn("p-2 rounded-xl", isActive ? "bg-primary/20" : "bg-muted")}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="text-[11px] font-semibold leading-tight text-center">{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
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
