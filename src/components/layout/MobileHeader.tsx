import { LogOut, User } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import logo from "@/assets/logo-icon.png";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";

/** Cabeçalho verde do aplicativo no celular, respeitando a área segura do aparelho. */
export function MobileHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    }
  }, [user]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[100] w-full pt-[env(safe-area-inset-top)] text-sidebar-accent-foreground bg-sidebar lg:hidden">
      <div className="flex h-[var(--header-height)] items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="LivreOS Enterprise - início">
          <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
          <span className="leading-none">
            <span className="block text-[22px] font-bold tracking-tight">LivreOS</span>
            <span className="block text-xs font-medium opacity-85">Enterprise</span>
          </span>
        </Link>
        <div className="flex items-center gap-1 [&_button]:text-sidebar-accent-foreground [&_button:hover]:bg-sidebar-accent">
          <NotificationBell compact />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative ml-1 h-10 w-10 rounded-full border-2 border-sidebar-accent-foreground/80 bg-sidebar-accent" aria-label="Menu da conta">
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold">{user?.email?.charAt(0)?.toUpperCase() || "U"}</span>}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar bg-primary-glow" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs truncate">{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="cursor-pointer text-xs"><User className="mr-2 h-3.5 w-3.5" />Meu perfil</DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer text-xs">
                <LogOut className="mr-2 h-3.5 w-3.5" />Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
