import { useState, useEffect } from "react";
import { LogOut, Home, Search, Building2, ChevronDown, Settings, User } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { openGlobalSearch, pageTitleFor } from "./openSearch";

/** Cabeçalho horizontal do computador: navegação atual, busca, notificações, tema, empresa e perfil. */
export function Header() {
  const { user, roles, signOut } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    }
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };
  const isAdmin = roles.includes("admin");

  return (
    <header className="hidden lg:flex h-[68px] shrink-0 items-center gap-6 border-b border-border bg-card px-8">
      <nav aria-label="Você está em" className="flex min-w-0 items-center gap-3 text-sm">
        <Link to="/dashboard" aria-label="Início" className="text-foreground hover:text-primary"><Home className="h-5 w-5" /></Link>
        <span className="truncate font-semibold text-foreground">{pageTitleFor(pathname)}</span>
      </nav>

      <button
        type="button"
        onClick={openGlobalSearch}
        className="mx-auto flex h-10 w-full max-w-md items-center gap-3 rounded-full border border-border bg-background px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar em todo o sistema...</span>
        <kbd className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px]">Ctrl + K</kbd>
      </button>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        {organization?.name && (
          <span className="hidden xl:flex items-center gap-2 px-2 text-sm font-medium text-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[160px] truncate">{organization.name}</span>
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 rounded-full p-0.5 hover:bg-muted" aria-label="Menu da conta">
              <span className="relative">
                <Avatar className="h-9 w-9">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{user?.email?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary-glow" />
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="cursor-pointer text-xs"><User className="mr-2 h-3.5 w-3.5" />Meu perfil</DropdownMenuItem>
            {isAdmin && <DropdownMenuItem onClick={() => navigate("/empresa")} className="cursor-pointer text-xs"><Settings className="mr-2 h-3.5 w-3.5" />Empresa</DropdownMenuItem>}
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
