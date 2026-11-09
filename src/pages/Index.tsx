import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, TrendingUp, Users, CheckCircle, ShoppingCart, Wallet, AlertTriangle,
  Package, Plus, BarChart3, FileText, ClipboardList, ArrowRight,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCard, KpiCard } from "@/components/premium";
import { OSSummaryDialog } from "@/components/os/OSSummaryDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { fetchOsComValores } from "@/lib/os-billing";
import { cn } from "@/lib/utils";

type Periodo = "hoje" | "7" | "30" | "365";
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "365", label: "12 meses" },
];

const FINALIZADAS = ["concluida", "pronto_retirada", "entregue", "finalizada"];
const ENCERRADAS = [...FINALIZADAS, "cancelada"];

const STATUS_LABEL: Record<string, string> = {
  recebido: "Recebido", aguardando_diagnostico: "Aguard. Diagnóstico", aguardando_aprovacao: "Aguard. Aprovação",
  aprovado: "Aprovado", em_reparo: "Em Reparo", em_testes: "Em Testes", pronto_retirada: "Pronto p/ Retirada",
  finalizada: "Finalizada", entregue: "Entregue", cancelada: "Cancelada", aberta: "Aberta",
  em_andamento: "Em Andamento", aguardando_peca: "Aguardando Peça", concluida: "Concluída",
};

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--destructive))",
  "hsl(var(--accent-foreground))", "hsl(var(--muted-foreground))", "hsl(var(--success, 152 60% 40%))",
];

function inicioPeriodo(p: Periodo) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p !== "hoje") d.setDate(d.getDate() - Number(p) + 1);
  return d;
}

function statusTone(status: string) {
  if (FINALIZADAS.includes(status)) return "bg-primary/10 text-primary";
  if (status === "cancelada") return "bg-destructive/10 text-destructive";
  if (["em_testes", "aguardando_peca", "aguardando_aprovacao"].includes(status)) return "bg-warning/15 text-warning";
  return "bg-muted text-muted-foreground";
}

interface Dados {
  receita: number; despesas: number; vendasTotal: number; vendasQtd: number;
  clientesTotal: number; clientesNovos: number; osTotal: number; osConcluidas: number;
  aReceber: number; aReceberQtd: number; estoqueBaixo: number;
  serie: { data: string; receita: number }[];
  tecnicos: { nome: string; os: number }[];
  statusOS: { name: string; value: number }[];
  osRecentes: any[]; vendasRecentes: any[]; osAtrasadas: any[];
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [osId, setOsId] = useState<string | null>(null);

  useEffect(() => {
    if (orgLoading) return;
    if (!organization?.id || !user) { setLoading(false); return; }
    void carregar(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, orgLoading, user, periodo]);

  const carregar = async (orgId: string) => {
    setLoading(true);
    const inicio = inicioPeriodo(periodo);
    const inicioIso = inicio.toISOString();
    const hoje = new Date().toISOString();
    try {
      const r = await Promise.allSettled([
        supabase.from("financeiro").select("valor, tipo, data_transacao").eq("organization_id", orgId).gte("data_transacao", inicioIso),
        supabase.from("vendas").select("id, numero, cliente_nome, valor_total, status_pagamento, data_venda, criado_em").eq("organization_id", orgId).gte("criado_em", inicioIso).order("criado_em", { ascending: false }),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", inicioIso),
        supabase.from("ordens_servico").select("id, numero, status, tecnico_id, created_at, data_conclusao, tipo_equipamento, modelo_equipamento, clientes(nome)").eq("organization_id", orgId).gte("created_at", inicioIso).order("created_at", { ascending: false }),
        supabase.from("itens_estoque").select("quantidade, estoque_minimo").eq("organization_id", orgId),
        supabase.from("ordens_servico").select("id, numero, clientes(nome)").eq("organization_id", orgId).not("data_previsao", "is", null).lt("data_previsao", hoje).not("status", "in", `(${ENCERRADAS.join(",")})`).order("data_previsao").limit(5),
        supabase.from("profiles").select("id, nome").eq("organization_id", orgId),
        fetchOsComValores(orgId),
      ]);
      const v = (i: number): any => (r[i].status === "fulfilled" ? (r[i] as PromiseFulfilledResult<any>).value : null);
      r.forEach((x, i) => x.status === "rejected" && console.error(`Dashboard consulta ${i}:`, x.reason));

      const fin: any[] = v(0)?.data || [];
      const vendas: any[] = v(1)?.data || [];
      const os: any[] = v(4)?.data || [];
      const perfis = new Map<string, string>((v(7)?.data || []).map((p: any) => [p.id, p.nome || "Sem nome"]));
      const osValores: any[] = v(8) || [];

      const receitaFin = fin.filter(f => f.tipo === "receita").reduce((a, f) => a + Number(f.valor || 0), 0);
      const despesas = fin.filter(f => f.tipo === "despesa").reduce((a, f) => a + Number(f.valor || 0), 0);
      const osAberto = osValores.filter(o => !o.pago && o.valor > 0 && FINALIZADAS.includes(o.status));
      const osFaturadasPeriodo = osAberto.filter(o => {
        const ref = o.data_entrega || o.data_conclusao;
        return ref ? new Date(ref) >= inicio : false;
      }).reduce((a, o) => a + o.valor, 0);
      const vendasTotal = vendas.reduce((a, s) => a + Number(s.valor_total || 0), 0);
      const vendasPendentes = vendas.filter(s => s.status_pagamento !== "pago");

      // Série diária/mensal de receita
      const mensal = periodo === "365";
      const buckets = new Map<string, number>();
      const chave = (d: Date) => mensal
        ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const cursor = new Date(inicio);
      const fim = new Date();
      while (cursor <= fim) {
        buckets.set(chave(cursor), 0);
        if (mensal) cursor.setMonth(cursor.getMonth() + 1); else cursor.setDate(cursor.getDate() + 1);
      }
      const somar = (data: string | null, valor: number) => {
        if (!data) return;
        const k = chave(new Date(data));
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + valor);
      };
      fin.filter(f => f.tipo === "receita").forEach(f => somar(f.data_transacao, Number(f.valor || 0)));
      vendas.forEach(s => somar(s.data_venda || s.criado_em, Number(s.valor_total || 0)));

      const porTec = new Map<string, number>();
      os.filter(o => FINALIZADAS.includes(o.status) && o.tecnico_id).forEach(o => {
        const n = perfis.get(o.tecnico_id) || "Técnico";
        porTec.set(n, (porTec.get(n) || 0) + 1);
      });
      const porStatus = new Map<string, number>();
      os.forEach(o => { const n = STATUS_LABEL[o.status] || o.status; porStatus.set(n, (porStatus.get(n) || 0) + 1); });

      setDados({
        receita: receitaFin + osFaturadasPeriodo + vendasTotal,
        despesas,
        vendasTotal,
        vendasQtd: vendas.length,
        clientesTotal: v(2)?.count || 0,
        clientesNovos: v(3)?.count || 0,
        osTotal: os.length,
        osConcluidas: os.filter(o => FINALIZADAS.includes(o.status)).length,
        aReceber: osValores.filter(o => !o.pago && o.valor > 0).reduce((a, o) => a + o.valor, 0)
          + vendasPendentes.reduce((a, s) => a + Number(s.valor_total || 0), 0),
        aReceberQtd: osValores.filter(o => !o.pago && o.valor > 0).length + vendasPendentes.length,
        estoqueBaixo: (v(5)?.data || []).filter((i: any) => Number(i.quantidade) <= Number(i.estoque_minimo)).length,
        serie: Array.from(buckets, ([data, receita]) => ({ data, receita })),
        tecnicos: Array.from(porTec, ([nome, n]) => ({ nome, os: n })).sort((a, b) => b.os - a.os).slice(0, 8),
        statusOS: Array.from(porStatus, ([name, value]) => ({ name, value })),
        osRecentes: os.slice(0, 5),
        vendasRecentes: vendas.slice(0, 5),
        osAtrasadas: v(6)?.data || [],
      });
    } catch (e) {
      console.error("Dashboard error:", e);
    } finally {
      setLoading(false);
    }
  };

  const lucro = (dados?.receita || 0) - (dados?.despesas || 0);
  const margem = dados?.receita ? Math.round((lucro / dados.receita) * 100) : 0;
  const conclusao = dados?.osTotal ? Math.round((dados.osConcluidas / dados.osTotal) * 100) : 0;
  const totalAlertas = (dados?.osAtrasadas.length || 0) + (dados?.estoqueBaixo ? 1 : 0);
  const periodoLabel = useMemo(() => PERIODOS.find(p => p.id === periodo)?.label, [periodo]);

  return (
    <MainLayout>
      <div className="space-y-6 py-6" data-tour="dashboard-content">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visão completa do negócio — serviços, vendas e financeiro</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
            {PERIODOS.map(p => (
              <Button key={p.id} size="sm" variant={periodo === p.id ? "default" : "ghost"} onClick={() => setPeriodo(p.id)}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2 bg-primary text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md" onClick={() => navigate("/ordens-servico")}><Plus className="h-4 w-4" />Nova OS</Button>
          <Button className="gap-2 bg-primary text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md" onClick={() => navigate("/vendas")}><ShoppingCart className="h-4 w-4" />Nova venda</Button>
          <Button className="gap-2 bg-primary text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md" onClick={() => navigate("/financeiro")}><DollarSign className="h-4 w-4" />Financeiro</Button>
          <Button className="gap-2 bg-primary text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md" onClick={() => navigate("/relatorios")}><BarChart3 className="h-4 w-4" />Relatórios</Button>
        </div>

        {/* KPIs */}
        {loading || !dados ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-28" /><Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Receita" value={formatCurrency(dados.receita)} icon={DollarSign} color="blue" trend={`Período: ${periodoLabel}`} onClick={() => navigate("/financeiro")} />
            <KpiCard label="Lucro operacional" value={formatCurrency(lucro)} icon={TrendingUp} color="green" trend={`${margem}% de margem • despesas ${formatCurrency(dados.despesas)}`} onClick={() => navigate("/financeiro")} />
            <KpiCard label="Clientes" value={dados.clientesTotal} icon={Users} color="purple" trend={`${dados.clientesNovos} novo(s) no período`} onClick={() => navigate("/clientes")} />
            <KpiCard label="Conclusão de OS" value={`${conclusao}%`} icon={CheckCircle} color="orange" trend={`${dados.osConcluidas} de ${dados.osTotal} finalizadas`} onClick={() => navigate("/ordens-servico")} />
            <KpiCard label="Vendas de produtos" value={formatCurrency(dados.vendasTotal)} icon={ShoppingCart} color="blue" trend={`${dados.vendasQtd} venda(s)`} onClick={() => navigate("/vendas")} />
            <KpiCard label="A receber" value={formatCurrency(dados.aReceber)} icon={Wallet} color="red" trend={`${dados.aReceberQtd} lançamento(s) em aberto`} onClick={() => navigate("/financeiro")} />
          </div>
        )}

        {/* Gráficos */}
        {dados && !loading && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PremiumCard>
              <ChartHeader title="Receita no período" badge={periodoLabel || ""} />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dados.serie} margin={{ left: 0, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} width={60} tickFormatter={(n) => `R$${Number(n) >= 1000 ? `${Math.round(n / 1000)}k` : n}`} />
                    <Tooltip formatter={(n: number) => formatCurrency(n)} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gReceita)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </PremiumCard>

            <PremiumCard>
              <ChartHeader title="Produtividade por técnico" badge="OS finalizadas" />
              <div className="h-64">
                {dados.tecnicos.length === 0 ? <Vazio texto="Nenhuma OS finalizada no período" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.tecnicos} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="os" name="OS" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </PremiumCard>

            <PremiumCard>
              <ChartHeader title="Status das ordens" badge={`Total: ${dados.osTotal}`} />
              <div className="h-64">
                {dados.statusOS.length === 0 ? <Vazio texto="Nenhuma OS no período" /> : (
                  <div className="flex h-full items-center gap-4">
                    <ResponsiveContainer width="55%" height="100%">
                      <PieChart>
                        <Pie data={dados.statusOS} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {dados.statusOS.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className="flex-1 space-y-1.5 text-xs">
                      {dados.statusOS.map((s, i) => (
                        <li key={s.name} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="truncate">{s.name}</span></span>
                          <span className="font-mono font-semibold">{s.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </PremiumCard>

            <PremiumCard>
              <ChartHeader title="Composição do resultado" badge={periodoLabel || ""} />
              <div className="space-y-5 pt-2">
                {[
                  { label: "Receita", valor: dados.receita, cls: "bg-primary" },
                  { label: "Despesas", valor: dados.despesas, cls: "bg-destructive" },
                  { label: "Lucro operacional", valor: lucro, cls: "bg-accent-foreground", forte: true },
                ].map(item => {
                  const max = Math.max(dados.receita, dados.despesas, Math.abs(lucro), 1);
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className={cn(item.forte && "font-semibold")}>{item.label}</span>
                        <span className={cn("font-mono font-semibold", item.label === "Despesas" || item.valor < 0 ? "text-destructive" : "text-primary")}>{formatCurrency(item.valor)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", item.cls)} style={{ width: `${(Math.abs(item.valor) / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </PremiumCard>
          </div>
        )}

        {/* Alertas */}
        {dados && !loading && (
          <div className="grid grid-cols-1 gap-4">
            <PremiumCard>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" />Requer atenção</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{totalAlertas}</span>
              </div>
              {totalAlertas === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4 text-primary" />Tudo em dia!</p>
              ) : (
                <div className="space-y-3">
                  {dados.osAtrasadas.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="mb-2 text-sm font-semibold text-destructive">{dados.osAtrasadas.length} ordem(ns) em atraso</p>
                      <div className="space-y-1">
                        {dados.osAtrasadas.map(o => (
                          <button key={o.id} className="flex w-full items-center justify-between rounded px-1 py-1 text-left text-sm hover:bg-destructive/10" onClick={() => setOsId(o.id)}>
                            <span><span className="font-mono">OS {o.numero}</span> — {o.clientes?.nome || "Cliente"}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {dados.estoqueBaixo > 0 && (
                    <button className="flex w-full items-center justify-between rounded-lg border border-warning/30 bg-warning/10 p-3 text-left" onClick={() => navigate("/compras")}>
                      <span className="flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4" />{dados.estoqueBaixo} item(ns) com estoque baixo</span>
                      <span className="text-xs text-muted-foreground">Pedido de compra →</span>
                    </button>
                  )}
                </div>
              )}
            </PremiumCard>
          </div>
        )}

        {/* Recentes */}
        {dados && !loading && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PremiumCard>
              <ListaHeader icon={ClipboardList} title="Ordens recentes" onAll={() => navigate("/ordens-servico")} />
              {dados.osRecentes.length === 0 ? <Vazio texto="Nenhuma OS no período" /> : (
                <div className="divide-y divide-border">
                  {dados.osRecentes.map(o => (
                    <button key={o.id} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/50" onClick={() => setOsId(o.id)}>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold">OS {o.numero}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.clientes?.nome || "Cliente"} • {o.modelo_equipamento || o.tipo_equipamento || "-"}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", statusTone(o.status))}>{STATUS_LABEL[o.status] || o.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </PremiumCard>

            <PremiumCard>
              <ListaHeader icon={FileText} title="Vendas recentes" onAll={() => navigate("/vendas")} />
              {dados.vendasRecentes.length === 0 ? <Vazio texto="Nenhuma venda no período" /> : (
                <div className="divide-y divide-border">
                  {dados.vendasRecentes.map(s => (
                    <button key={s.id} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/50" onClick={() => navigate("/vendas")}>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold">Venda {s.numero ?? ""}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.cliente_nome || "Consumidor"} • {s.status_pagamento === "pago" ? "Pago" : "Pendente"}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-primary">{formatCurrency(Number(s.valor_total || 0))}</span>
                    </button>
                  ))}
                </div>
              )}
            </PremiumCard>
          </div>
        )}

        {/* FAB mobile */}
        <button
          aria-label="Nova OS"
          className="fixed bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+16px)] right-5 z-[90] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 lg:hidden"
          onClick={() => navigate("/ordens-servico")}
        >
          <Plus className="h-5 w-5" />
        </button>

        <OSSummaryDialog osId={osId} onOpenChange={(o) => { if (!o) setOsId(null); }} />
      </div>
    </MainLayout>
  );
};

const tooltipStyle = {
  background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
  borderRadius: 8, color: "hsl(var(--popover-foreground))", fontSize: 12,
};

function ChartHeader({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-base font-semibold">{title}</h3>
      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>
    </div>
  );
}

function ListaHeader({ icon: Icon, title, onAll }: { icon: typeof FileText; title: string; onAll: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-base font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      <Button size="sm" variant="ghost" onClick={onAll}>Ver todas<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">{texto}</div>;
}

export default Index;
