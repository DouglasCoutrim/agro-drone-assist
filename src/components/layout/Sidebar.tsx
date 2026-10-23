import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Package, BarChart3, DollarSign, Settings,
  Users, CreditCard, UsersRound, Building2, ClipboardList, LogOut, LifeBuoy, BookOpen, Bell, ShieldCheck, Wrench, Monitor, Calculator, PiggyBank, ShoppingCart, Boxes
} from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-icon.png";
import { sectionsForRoles } from "./navConfig";

interface SidebarProps { className?: string; }

// Platform section removed from main sidebar as requested to avoid confusion with client dashboard

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { roles, user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ nome: string; avatar_url: string | null } | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("nome, avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data) setProfile(data); });
      
      supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => setIsPlatformAdmin(!!data));
    }
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const roleLabel = roles.map((item) => item === "admin" ? "Administrador" : item === "tecnico" ? "Técnico" : "Atendimento").join(" • ") || "Sem papel";
  const initials = profile?.nome?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className={cn(
      "flex h-full flex-col bg-sidebar overflow-hidden flex-shrink-0",
      className
    )} style={{ width: "var(--sidebar-width)" }}>
      {/* Logo */}
      <div className="flex flex-col items-center gap-1 px-5 py-5 border-b border-sidebar-border mb-2 ">
        <img src={logo} alt="LivreOS" className="h-12 w-auto" />
        <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Gestão completa para seu negócio</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto scrollbar-thin">
        {/* Regular navigation sections */}
        {sectionsForRoles(roles).map((section) => {
          const sectionItems = section.items;
          return (
            <div key={section.title}>
              <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-muted-foreground/70 px-2 pt-3 pb-1 mt-2 first:mt-0">
                {section.title}
              </p>
              {sectionItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-normal transition-all duration-150 border border-transparent",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-primary-foreground/60 rounded-r-sm" />
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
      <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
        {isPlatformAdmin && (
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 mb-2"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Painel Admin Master
          </Link>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-primary to-emerald-800 flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-sidebar-accent-foreground leading-tight truncate">{profile?.nome || user?.email?.split("@")[0]}</p>
            <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
