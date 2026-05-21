import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Package, LifeBuoy, Megaphone, BookOpen, Settings, LogOut, ShieldCheck, ArrowLeft
} from "lucide-react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

const navSections = [
  {
    title: "GERENCIAMENTO",
    items: [
      { title: "Visão Geral", icon: LayoutDashboard, href: "/admin-master?tab=overview" },
      { title: "Clientes (Tenants)", icon: Building2, href: "/admin-master?tab=tenants" },
      { title: "Planos & Preços", icon: Package, href: "/admin-master?tab=plans" },
    ],
  },
  {
    title: "OPERACIONAL",
    items: [
      { title: "Suporte Global", icon: LifeBuoy, href: "/admin-master?tab=support" },
      { title: "Comunicados", icon: Megaphone, href: "/admin-master?tab=broadcast" },
      { title: "Wiki do Sistema", icon: BookOpen, href: "/admin-master?tab=wiki" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { title: "Configurações Asaas", icon: Settings, href: "/admin-master?tab=config" },
    ],
  },
];

export function PlatformSidebar({ className }: { className?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  const currentTab = new URLSearchParams(location.search).get("tab") || "overview";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className={cn(
      "flex h-full flex-col bg-slate-950 border-r border-slate-800 overflow-hidden flex-shrink-0",
      className
    )} style={{ width: "260px" }}>
      {/* Admin Branding */}
      <div className="flex flex-col items-center gap-1 px-5 py-6 border-b border-slate-800 bg-slate-900/50">
        <img src={logo} alt="LivreOS" className="h-10 w-auto brightness-110" />
        <div className="mt-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
           <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">PLATFORM ADMIN</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500 px-3 mb-2">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === "/admin-master" && (item.href.includes(`tab=${currentTab}`));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200",
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-indigo-400")} />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-slate-800">
           <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Sistema
          </Link>
        </div>
      </nav>

      {/* User info */}
      <div className="p-4 bg-slate-900/80 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-xs font-bold text-white uppercase">
            {user?.email?.[0] || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.email}</p>
            <p className="text-[10px] text-slate-500">Super Administrator</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
