import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const typeColor: Record<string, string> = {
  os: "bg-blue-500/15 text-blue-400",
  estoque: "bg-amber-500/15 text-amber-400",
  financeiro: "bg-emerald-500/15 text-emerald-400",
  suporte: "bg-purple-500/15 text-purple-400",
  plataforma: "bg-primary/15 text-primary",
  info: "bg-muted text-muted-foreground",
};

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const { items, unread, markAsRead, markAllAsRead } = useNotifications(10);
  const navigate = useNavigate();

  const handleClick = async (id: string, link: string | null) => {
    await markAsRead(id);
    if (link) navigate(link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações"
          className={cn(
            "relative rounded-lg border border-border bg-card text-muted-foreground flex items-center justify-center transition-all hover:bg-background hover:text-foreground",
            compact ? "w-9 h-9" : "w-9 h-9"
          )}
        >
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-[11px] text-muted-foreground">{unread} não lidas</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Inbox className="h-8 w-8 opacity-50" />
              <p className="text-xs">Nenhuma notificação por aqui.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => handleClick(n.id, n.link)}
                  className={cn(
                    "px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors",
                    !n.read_at && "bg-primary/[0.04]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={cn("text-[9px] uppercase px-1.5 py-0", typeColor[n.type] || typeColor.info)}>
                      {n.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs leading-snug", !n.read_at ? "font-semibold" : "font-medium")}>{n.title}</p>
                      {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!n.read_at && <span className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate("/notificacoes")}>
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
