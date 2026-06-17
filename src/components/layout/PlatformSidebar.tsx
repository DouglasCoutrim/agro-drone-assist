import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Package, LifeBuoy, Megaphone, BookOpen, Settings, LogOut, ShieldCheck, Globe
} from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

const navSections = [
  {
    title: "PRINCIPAL",
    items: [
      { title: "Visão Geral", icon: LayoutDashboard, href: "/admin/dashboard?tab=overview" },
      { title: "Clientes (Tenants)", icon: Building2, href: "/admin/dashboard?tab=tenants" },
      { title: "Planos & Preços", icon: Package, href: "/admin/dashboard?tab=plans" },
    ],
  },
  {
    title: "OPERACIONAL",
    items: [
      { title: "Suporte Global", icon: LifeBuoy, href: "/admin/dashboard?tab=support" },
      { title: "Comunicados", icon: Megaphone, href: "/admin/dashboard?tab=broadcast" },
      { title: "Wiki do Sistema", icon: BookOpen, href: "/admin/dashboard?tab=wiki" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { title: "Gestão do Site", icon: Globe, href: "/admin/dashboard?tab=site" },
      { title: "Configurações Asaas", icon: Settings, href: "/admin/dashboard?tab=config" },
    ],
  },
];

export function PlatformSidebar({ className, onNavigate }: { className?: string, onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  const currentTab = new URLSearchParams(location.search).get("tab") || "overview";

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className={cn(
      "flex h-full w-full md:w-64 flex-col bg-sidebar md:border-r border-sidebar-border flex-shrink-0",
      className
    )}>
      {/* Admin Branding */}
      <div className="flex flex-col items-center gap-1 px-5 py-6 border-b border-sidebar-border bg-sidebar-accent/30">
        <img src={logo} alt="LivreOS" className="h-10 w-auto" />
        <div className="mt-2 px-2 py-0.5 rounded bg-sidebar-primary/10 border border-sidebar-primary/20">
           <span className="text-[10px] text-sidebar-primary font-bold tracking-widest uppercase">PLATFORM ADMIN</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto max-h-[400px] md:max-h-none">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-sidebar-foreground/50 px-3 mb-2">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === "/admin/dashboard" && (item.href.includes(`tab=${currentTab}`));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/40 group-hover:text-sidebar-primary")} />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info */}
      <div className="p-4 bg-sidebar-accent/50 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground uppercase">
            {user?.email?.[0] || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.email}</p>
            <p className="text-[10px] text-sidebar-foreground/50">Super Administrator</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}