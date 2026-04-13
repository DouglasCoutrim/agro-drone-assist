import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Package, BarChart3, DollarSign, Settings,
  Users, Zap, CreditCard, UsersRound, Building2, ClipboardList, Route, LogOut
} from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SidebarProps { className?: string; }

const navSections = [
  {
    title: "PRINCIPAL",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, href: "/", roles: ["admin", "tecnico", "consulta"] },
      { title: "Ordens de Serviço", icon: FileText, href: "/ordens-servico", roles: ["admin", "tecnico", "consulta"] },
      { title: "Clientes", icon: Users, href: "/clientes", roles: ["admin", "tecnico", "consulta"] },
    ],
  },
  {
    title: "GESTÃO",
    items: [
      { title: "Estoque", icon: Package, href: "/estoque", roles: ["admin", "tecnico", "consulta"] },
      { title: "Financeiro", icon: DollarSign, href: "/financeiro", roles: ["admin", "tecnico"] },
      { title: "Cobranças", icon: CreditCard, href: "/cobrancas", roles: ["admin", "tecnico"] },
      { title: "Orçamentos", icon: ClipboardList, href: "/orcamentos", roles: ["admin", "tecnico"] },
      { title: "Rotas", icon: Route, href: "/rotas", roles: ["admin", "tecnico"] },
      { title: "Relatórios", icon: BarChart3, href: "/relatorios", roles: ["admin", "tecnico", "consulta"] },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { title: "Equipe", icon: UsersRound, href: "/equipe", roles: ["admin"] },
      { title: "Empresa", icon: Building2, href: "/empresa", roles: ["admin"] },
      { title: "Configurações", icon: Settings, href: "/configuracoes", roles: ["admin"] },
    ],
  },
];

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ nome: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("nome, avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data) setProfile(data); });
    }
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const roleLabel = role === "admin" ? "Administrador" : role === "tecnico" ? "Técnico" : "Consulta";
  const initials = profile?.nome?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className={cn(
      "flex h-full flex-col bg-sidebar overflow-hidden flex-shrink-0",
      className
    )} style={{ width: "var(--sidebar-width)" }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06] mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center flex-shrink-0">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-display font-extrabold text-lg text-white leading-none tracking-tight">VoltControl</h2>
          <p className="text-[10px] text-white/35 mt-0.5">Gestão de Oficina</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto scrollbar-thin">
        {navSections.map((section) => {
          const items = section.items.filter(item => role && item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-white/25 px-2 pt-3 pb-1 mt-2 first:mt-0">
                {section.title}
              </p>
              {items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-normal transition-all duration-150 border border-transparent",
                      isActive
                        ? "bg-primary/[0.12] text-emerald-400 font-medium border-emerald-400/15"
                        : "text-white/60 hover:bg-white/[0.07] hover:text-white/90"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-emerald-500 rounded-r-sm" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "opacity-100" : "opacity-70")} />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-primary to-emerald-800 flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white/85 leading-tight truncate">{profile?.nome || user?.email?.split("@")[0]}</p>
            <p className="text-[11px] text-white/35">{roleLabel}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
