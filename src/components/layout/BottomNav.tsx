import { LayoutDashboard, FileText, Users, Package, MoreHorizontal } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { sectionsForRoles } from "./navConfig";
import { NavModules } from "./NavModules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="lg:hidden max-w-md max-h-[80dvh] flex flex-col">
          <DialogHeader><DialogTitle>Módulos</DialogTitle></DialogHeader>
          <div className="min-h-0 overflow-y-auto"><NavModules sections={sections} onNavigate={() => setDrawerOpen(false)} /></div>
        </DialogContent>
      </Dialog>

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[var(--bottom-nav-height)] pb-[env(safe-area-inset-bottom)] bg-card/90 backdrop-blur-xl border-t border-border flex items-center justify-around px-4 z-[100] lg:hidden w-full transition-all duration-300 shadow-soft">
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
              {isActive && <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-full" />}
              <Icon className={cn("h-6 w-6 transition-transform", isActive && "scale-110")} />
              <span className={cn(
                "text-[10px] leading-none tracking-tight",
                isActive ? "font-bold" : "font-medium"
              )}>{item.label}</span>
            </Link>
          );
        })}
        <Button variant="ghost" aria-label="Mais" aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 py-2 transition-all active:scale-90",
            drawerOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className={cn("h-6 w-6 transition-transform", drawerOpen && "scale-110 rotate-90")} />
          <span className="text-[10px] font-medium leading-none tracking-tight">Mais</span>
        </Button>
      </nav>
    </>
  );
}
