import { Bell, User, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6 shadow-soft">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar OS, cliente, equipamento..."
            className="w-80 pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge 
            variant="destructive" 
            className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
          >
            3
          </Badge>
        </Button>
        
        <Button variant="ghost" className="gap-2">
          <User className="h-5 w-5" />
          <span className="hidden md:inline">João Silva</span>
        </Button>
      </div>
    </header>
  );
}