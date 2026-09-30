import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import logo from "@/assets/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export function MobileHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };
  const roleBadge = role === "admin"
    ? <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">Admin</Badge>
    : role === "tecnico"
    ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Técnico</Badge>
    : role === "consulta"
    ? <Badge variant="outline" className="text-[10px] px-1.5 py-0">Consulta</Badge>
    : null;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    }
  }, [user]);

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-card/90 backdrop-blur-xl border-b border-border flex items-center justify-between px-5 z-[100] lg:hidden w-full transition-all duration-300 shadow-sm">
      <div className="flex items-center">
        <img src={logo} alt="LivreOS" className="h-9 w-auto drop-shadow-[0_2px_8px_rgba(57,255,20,0.2)]" />
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell compact />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center ml-1" aria-label="Menu da conta">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-primary">{user?.email?.charAt(0)?.toUpperCase() || "U"}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs flex items-center justify-between gap-2">
              <span className="truncate">{user?.email}</span>
              {roleBadge}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer text-xs">
              <LogOut className="mr-2 h-3.5 w-3.5" />Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
