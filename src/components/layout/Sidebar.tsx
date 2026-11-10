import { usePermissions } from "@/hooks/usePermissions";
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
import { NavModules } from "./NavModules";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/useOrganization";

interface SidebarProps { className?: string; }

// Platform section removed from main sidebar as requested to avoid confusion with client dashboard

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { roles, user, signOut } = useAuth();
  const { blocked } = usePermissions();
  const { organization } = useOrganization();
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
      <Link to="/dashboard" className="flex items-center gap-3 px-5 py-5 mb-1" aria-label="LivreOS Enterprise - início">
        <img src={logo} alt="" className="h-11 w-11 object-contain" />
        <div className="leading-tight">
          <p className="text-xl font-bold tracking-tight text-sidebar-accent-foreground">LivreOS</p>
          <p className="text-[11px] font-medium text-sidebar-foreground/80">Enterprise</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto scrollbar-thin">
        <NavModules dark flat sections={sectionsForRoles(roles, blocked)} />
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
        {isPlatformAdmin && (
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary mb-2"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Painel Admin Master
          </Link>
        )}

        {organization?.name && (
          <Link to="/empresa" className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent/60 p-2 hover:bg-sidebar-accent">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Building2 className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-sidebar-accent-foreground">{organization.name}</span>
              <span className="block text-[11px] text-sidebar-foreground/70">Sua empresa</span>
            </span>
          </Link>
        )}
        <div className="flex items-center gap-2.5 rounded-xl bg-sidebar-accent/60 p-2">
          <div className="w-[36px] h-[36px] rounded-full bg-sidebar-primary flex items-center justify-center text-[13px] font-bold text-primary-foreground flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-sidebar-accent-foreground leading-tight truncate">{profile?.nome || user?.email?.split("@")[0]}</p>
            <p className="text-[11px] text-sidebar-foreground/70">{roleLabel}</p>
          </div>
          <Button variant="ghost" size="icon"
            onClick={handleSignOut}
            className="w-7 h-7 rounded flex items-center justify-center text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
