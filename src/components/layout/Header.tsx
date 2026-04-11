import { useState, useEffect } from "react";
import { Bell, User, Search, Menu, LogOut, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps { onMenuToggle?: () => void; }

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
    }
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  const getRoleBadge = () => {
    switch (role) {
      case 'admin': return <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">Admin</Badge>;
      case 'tecnico': return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Técnico</Badge>;
      case 'consulta': return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Consulta</Badge>;
      default: return null;
    }
  };

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onMenuToggle}>
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5 md:hidden">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">VoltControl</span>
        </div>
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="w-64 h-8 pl-8 text-sm bg-muted/50 border-0" />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-1.5 h-8 px-2">
              <Avatar className="h-6 w-6">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="avatar" /> : null}
                <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{user?.email?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-xs">{user?.email?.split('@')[0]}</span>
              {getRoleBadge()}
            </Button>
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
