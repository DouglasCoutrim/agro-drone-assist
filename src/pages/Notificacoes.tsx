import { MainLayout } from "@/components/layout/MainLayout";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { CheckCheck, Trash2, Inbox, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "all", label: "Todas" },
  { key: "os", label: "OS" },
  { key: "estoque", label: "Estoque" },
  { key: "financeiro", label: "Financeiro" },
  { key: "suporte", label: "Suporte" },
  { key: "plataforma", label: "Plataforma" },
];

export default function Notificacoes() {
  const { items, unread, markAsRead, markAllAsRead, remove, loading } = useNotifications(200);
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigate = useNavigate();

  const filtered = items.filter((n) => {
    if (tab !== "all" && n.type !== tab) return false;
    if (filter === "unread" && n.read_at) return false;
    return true;
  });

  return (
    <MainLayout>
      <div className="space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" /> Notificações
            </h1>
            <p className="text-xs text-muted-foreground">{unread} não lidas de {items.length} totais</p>
          </div>
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Todas</Button>
            <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>Não lidas</Button>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-1" />Marcar todas
              </Button>
            )}
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            {TYPES.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Carregando…</p>
            ) : filtered.length === 0 ? (
              <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
                <Inbox className="h-10 w-10 opacity-50" />
                <p className="text-sm">Nenhuma notificação nesta categoria.</p>
              </Card>
            ) : (
              <ul className="space-y-2">
                {filtered.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition",
                      !n.read_at && "border-l-2 border-l-primary"
                    )}
                  >
                    <Badge variant="outline" className="uppercase text-[10px] mt-0.5">{n.type}</Badge>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={async () => { await markAsRead(n.id); if (n.link) navigate(n.link); }}
                    >
                      <p className={cn("text-sm", !n.read_at ? "font-semibold" : "font-medium")}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(n.id)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
