import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { OSSummaryDialog } from "./OSSummaryDialog";

const DONE = new Set(["pronto_retirada", "entregue", "finalizada", "concluida"]);
const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 200 70% 50%))", "hsl(var(--chart-3, 40 90% 55%))", "hsl(var(--chart-4, 280 60% 60%))", "hsl(var(--chart-5, 0 70% 60%))", "hsl(var(--muted-foreground))"];

export function TechnicianAnalytics({ userId }: { userId: string }) {
  const [days, setDays] = useState("30");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const { data } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, created_at, recebida_em, data_conclusao, commission_services, commission_products, commission_total, clientes(nome)")
        .eq("tecnico_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (active) { setRows((data as any[]) || []); setLoading(false); }
    })();
    return () => { active = false; };
  }, [userId, days]);

  const m = useMemo(() => {
    const aceitas = rows.filter((r) => r.recebida_em).length;
    const finalizadas = rows.filter((r) => DONE.has(r.status));
    const pendentes = rows.filter((r) => !DONE.has(r.status) && r.status !== "cancelada");
    const aReceber = finalizadas.reduce((s, r) => s + Number(r.commission_total || 0), 0);
    const estimado = pendentes.reduce((s, r) => s + Number(r.commission_total || 0), 0);
    const byStatus: Record<string, number> = {};
    rows.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const byDay: Record<string, { dia: string; servico: number; pecas: number; abertas: number; finalizadas: number }> = {};
    rows.forEach((r) => {
      const d = (r.created_at || "").slice(5, 10).split("-").reverse().join("/");
      byDay[d] ??= { dia: d, servico: 0, pecas: 0, abertas: 0, finalizadas: 0 };
      byDay[d].abertas++;
      if (DONE.has(r.status)) {
        byDay[d].finalizadas++;
        byDay[d].servico += Number(r.commission_services || 0);
        byDay[d].pecas += Number(r.commission_products || 0);
      }
    });
    return {
      aceitas, finalizadas: finalizadas.length, pendentes,
      aReceber, estimado,
      status: Object.entries(byStatus).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })),
      dias: Object.values(byDay).reverse(),
    };
  }, [rows]);

  const Kpi = ({ l, v }: { l: string; v: string | number }) => (
    <Card><CardContent className="p-4"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-lg font-semibold">Meus indicadores</h2>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Kpi l="OS recebidas" v={rows.length} />
            <Kpi l="OS aceitas" v={m.aceitas} />
            <Kpi l="OS finalizadas" v={m.finalizadas} />
            <Kpi l="Comissão a receber" v={formatCurrency(m.aReceber)} />
            <Kpi l="Comissão em andamento" v={formatCurrency(m.estimado)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Comissões por dia (serviço x peças)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.dias}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="servico" name="Serviço" stackId="a" fill={COLORS[0]} />
                    <Bar dataKey="pecas" name="Peças" stackId="a" fill={COLORS[2]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">OS abertas x finalizadas</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.dias}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="abertas" name="Abertas" fill={COLORS[1]} />
                    <Bar dataKey="finalizadas" name="Finalizadas" fill={COLORS[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">OS por status</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={m.status} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                      {m.status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Minhas OS em andamento ({m.pendentes.length})</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 max-h-64 overflow-y-auto">
                {m.pendentes.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma OS em andamento.</p> :
                  m.pendentes.map((r) => (
                    <button key={r.id} onClick={() => setOpenId(r.id)} className="w-full text-left flex justify-between items-center p-2 rounded-lg border border-border hover:bg-accent/50">
                      <span className="text-xs"><span className="font-mono font-semibold">#{r.numero}</span> • {r.clientes?.nome || "—"}</span>
                      <span className="text-xs capitalize text-muted-foreground">{r.status.replace(/_/g, " ")}</span>
                    </button>
                  ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <OSSummaryDialog osId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
