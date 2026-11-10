import { usePermissions } from "@/hooks/usePermissions";
import { Home, ClipboardList, BarChart3, Menu, Plus, Wrench, ShoppingCart, FileText, UserPlus, Package, type LucideIcon } from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { sectionsForRoles, canAccessHref } from "./navConfig";
import { NavModules } from "./NavModules";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STAFF = ["admin", "tecnico"];
const quickActions: { label: string; href: string; icon: LucideIcon; roles: string[] }[] = [
  { label: "Nova OS", href: "/ordens-servico", icon: Wrench, roles: ["admin", "tecnico", "consulta"] },
  { label: "Nova venda", href: "/pdv", icon: ShoppingCart, roles: STAFF },
  { label: "Orçamento", href: "/orcamentos", icon: FileText, roles: STAFF },
  { label: "Cliente", href: "/clientes", icon: UserPlus, roles: ["admin", "tecnico", "consulta"] },
  { label: "Estoque", href: "/estoque", icon: Package, roles: ["admin", "tecnico", "consulta"] },
];

/** Barra inferior do aplicativo: Início, Operação, adicionar, Relatórios e Mais. */
export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { blocked } = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const sections = sectionsForRoles(roles, blocked);
  const actions = quickActions.filter(a => roles.some(r => a.roles.includes(r)) && canAccessHref(a.href, roles, blocked));

  const Tab = ({ to, icon: Icon, label, match }: { to: string; icon: LucideIcon; label: string; match: string[] }) => {
    const active = match.some(m => pathname.startsWith(m));
    return (
      <Link to={to} aria-current={active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center gap-1 py-2 transition-transform active:scale-90", active ? "text-primary" : "text-muted-foreground")}>
        <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
        <span className={cn("text-[11px] leading-none", active ? "font-bold" : "font-medium")}>{label}</span>
      </Link>
    );
  };

  return (
    <>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="lg:hidden max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader><SheetTitle>Módulos</SheetTitle></SheetHeader>
          <div className="mt-2"><NavModules sections={sections} onNavigate={() => setMoreOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader><SheetTitle>Adicionar</SheetTitle></SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {actions.map(a => (
              <button key={a.label} onClick={() => { setAddOpen(false); navigate(a.href); }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm font-medium active:scale-95">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground"><a.icon className="h-5 w-5" /></span>
                {a.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <nav aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-[100] w-full border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_hsl(var(--foreground)/0.06)] lg:hidden">
        <div className="flex h-[var(--bottom-nav-height)] items-center px-2">
          <Tab to="/dashboard" icon={Home} label="Início" match={["/dashboard"]} />
          <Tab to="/ordens-servico" icon={ClipboardList} label="Operação" match={["/ordens-servico", "/orcamentos"]} />
          <div className="flex flex-1 justify-center">
            <button aria-label="Adicionar" onClick={() => setAddOpen(true)}
              className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90">
              <Plus className="h-8 w-8" />
            </button>
          </div>
          <Tab to="/relatorios" icon={BarChart3} label="Relatórios" match={["/relatorios"]} />
          <button aria-label="Mais" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}
            className={cn("flex flex-1 flex-col items-center gap-1 py-2 active:scale-90", moreOpen ? "text-primary" : "text-muted-foreground")}>
            <Menu className="h-6 w-6" />
            <span className="text-[11px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
