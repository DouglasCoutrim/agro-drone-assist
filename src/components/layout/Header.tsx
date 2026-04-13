import { useState, useEffect } from "react";
import { Bell, Search, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface HeaderProps { onMenuToggle?: () => void; }

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    }
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const getRoleBadge = () => {
    switch (role) {
      case "admin": return <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">Admin</Badge>;
      case "tecnico": return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Técnico</Badge>;
      case "consulta": return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Consulta</Badge>;
      default: return null;
    }
  };

  return (
    <header className="hidden lg:flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Buscar..."
          className="w-72 h-10 pl-10 pr-4 text-sm bg-background border border-border rounded-xl outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button className="w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground flex items-center justify-center relative transition-all hover:bg-background hover:text-foreground">
          <Bell size={16} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-muted transition-colors">
              <Avatar className="h-7 w-7">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="avatar" /> : null}
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{user?.email?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user?.email?.split("@")[0]}</span>
              {getRoleBadge()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs">{user?.email}</DropdownMenuLabel>
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
