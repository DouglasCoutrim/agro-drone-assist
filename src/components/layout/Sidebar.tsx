import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-icon.png";
import { sectionsForRoles } from "./navConfig";
import { NavModules } from "./NavModules";

interface SidebarProps { className?: string; }

// Platform section removed from main sidebar as requested to avoid confusion with client dashboard

export function Sidebar({ className }: SidebarProps) {
  const { roles, user } = useAuth();
  const { blocked } = usePermissions();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => setIsPlatformAdmin(!!data));
    }
  }, [user]);

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
        <NavModules dark sections={sectionsForRoles(roles, blocked)} />
      </nav>

      {isPlatformAdmin && (
        <div className="border-t border-sidebar-border px-3 py-3">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary mb-2"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Painel Admin Master
          </Link>
        </div>
      )}
    </div>
  );
}
