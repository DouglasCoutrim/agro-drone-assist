import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins, CheckCircle2, ListChecks, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";

interface OSKanban {
  id: string;
  numero: string;
  cliente: string | null;
  equipamento: string | null;
  tipo_equipamento?: string;
  prioridade: string;
  status: string;
  tempo_em_bancada_min: number;
  data_previsao: string | null;
  commission_total: number;
}

interface NextOS {
  id: string;
  numero: string;
  cliente: string | null;
  equipamento: string | null;
  prioridade: string;
  status: string;
  data_previsao: string | null;
}

interface DashboardPayload {
  realized_month: number;
  estimated_month: number;
  services_done_month: number;
  kanban: Record<string, OSKanban[]>;
  next_os: NextOS | null;
}

const KANBAN_COLUMNS: { key: string; label: string }[] = [
  { key: "aguardando_avaliacao", label: "Aguardando Avaliação" },
  { key: "em_analise", label: "Em Análise" },
  { key: "aguardando_peca", label: "Aguardando Peça" },
  { key: "em_execucao", label: "Em Execução" },
  { key: "concluido", label: "Concluído" },
];

const prioridadeVariant = (p: string) => {
  const v = (p || "normal").toLowerCase();
  if (v === "alta" || v === "urgente") return "destructive" as const;
  if (v === "media") return "default" as const;
  return "secondary" as const;
};

const formatBenchTime = (mins: number) => {
  if (mins < 60) return `${mins}min`;
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
};

function KpiCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <p className="font-display text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: res } = await supabase.rpc("get_technician_dashboard" as any, { _tecnico_id: user.id });
      setData(res as DashboardPayload | null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const next = data?.next_os;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold">Meu Painel</h1>
            <p className="text-sm text-muted-foreground">Acompanhe suas ordens de serviço e comissões</p>
          </div>
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Fila prioritária */}
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-5 flex items-center gap-4 flex-wrap">
              <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center"><ListChecks className="h-6 w-6 text-primary" /></div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Próxima OS da Fila</p>
                {next ? (
                  <div className="flex items-center gap-3 flex-wrap mt-0.5">
                    <span className="font-mono font-bold text-lg">{next.numero}</span>
                    <span className="font-medium">{next.cliente || "—"}</span>
                    <Badge variant="outline">{next.equipamento || "—"}</Badge>
                    <Badge variant={prioridadeVariant(next.prioridade)}>{next.prioridade}</Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">Nenhuma OS na fila de trabalho.</p>
                )}
              </div>
            </div>

            {/* Resumo financeiro */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <KpiCard label="Comissões Realizadas (Mês)" value={formatCurrency(data.realized_month ?? 0)} icon={Coins} color="bg-green-500/15 text-green-600" />
              <KpiCard label="Comissões Estimadas (Mês)" value={formatCurrency(data.estimated_month ?? 0)} icon={Clock} color="bg-blue-500/15 text-blue-600" sub="OS em andamento/aprovação" />
              <KpiCard label="Serviços Concluídos (Mês)" value={data.services_done_month ?? 0} icon={CheckCircle2} color="bg-violet-500/15 text-violet-600" />
            </div>

            {/* Kanban */}
            <div className="grid gap-4 lg:grid-cols-5">
              {KANBAN_COLUMNS.map(col => {
                const list = data.kanban?.[col.key] || [];
                return (
                  <div key={col.key} className="rounded-2xl border border-border bg-muted/30 flex flex-col">
                    <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
                      <p className="text-xs font-semibold uppercase tracking-wide">{col.label}</p>
                      <span className="text-xs bg-background border border-border rounded-full px-2 py-0.5">{list.length}</span>
                    </div>
                    <div className="p-2 space-y-2 overflow-y-auto max-h-[420px]">
                      {list.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">Sem OS</p>
                      )}
                      {list.map(os => (
                        <div key={os.id} className="bg-card border border-border rounded-xl p-3 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold">{os.numero}</span>
                            <Badge variant={prioridadeVariant(os.prioridade)} className="capitalize">{os.prioridade}</Badge>
                          </div>
                          <p className="text-sm font-medium truncate">{os.cliente || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{os.equipamento || "—"}</p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatBenchTime(os.tempo_em_bancada_min)} em bancada</span>
                            {os.commission_total ? <span className="text-green-600 font-medium">{formatCurrency(os.commission_total)}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}