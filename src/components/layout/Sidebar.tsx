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
        <p className="text-base font-semibold text-sidebar-foreground">LivreOS</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto scrollbar-thin">
        <NavModules sections={sectionsForRoles(roles)} />
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
        {isPlatformAdmin && (
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 bg-secondary text-secondary-foreground border border-border hover:bg-accent mb-2"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Painel Admin Master
          </Link>
        )}

        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-lg bg-primary flex items-center justify-center text-[13px] font-bold text-primary-foreground flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-sidebar-accent-foreground leading-tight truncate">{profile?.nome || user?.email?.split("@")[0]}</p>
            <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
          <Button variant="ghost" size="icon"
            onClick={handleSignOut}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
