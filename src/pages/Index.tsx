import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, TrendingUp, Users, CheckCircle, ShoppingCart, Wallet, AlertTriangle,
  Package, Plus, BarChart3, FileText, ClipboardList, ArrowRight,
  Wrench, Search, ArrowUp, ArrowDown, SlidersHorizontal, CalendarDays, RefreshCw, PieChart as PieIcon, ChevronRight, Zap,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { openGlobalSearch } from "@/components/layout/openSearch";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumCard, KpiCard } from "@/components/premium";
import { OSSummaryDialog } from "@/components/os/OSSummaryDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency, parseDate, todayDateInput } from "@/lib/formatters";
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
  anterior: { receita: number; lucro: number; os: number; clientes: number };
  barras: { receita: number[]; os: number[]; clientes: number[] };
}

/** Variação percentual entre o período atual e o anterior (null quando não há base). */
function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return atual > 0 ? 100 : null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Divide uma série em 5 grupos somados, para as barrinhas dos indicadores. */
function cincoBarras(valores: number[]): number[] {
  if (!valores.length) return [0, 0, 0, 0, 0];
  const tam = Math.ceil(valores.length / 5);
  return Array.from({ length: 5 }, (_, i) => valores.slice(i * tam, (i + 1) * tam).reduce((a, n) => a + n, 0));
}

function MiniBarras({ valores, claro }: { valores: number[]; claro?: boolean }) {
  const max = Math.max(...valores, 1);
  return (
    <span className="flex h-8 items-end gap-[3px]" aria-hidden>
      {valores.map((v, i) => (
        <span key={i} className={cn("w-[7px] rounded-[2px]", claro ? "bg-primary-glow/35" : "bg-primary-glow/40", i === valores.length - 1 && "bg-primary-glow")}
          style={{ height: `${Math.max(18, (v / max) * 100)}%`, opacity: 0.45 + (i / valores.length) * 0.55 }} />
      ))}
    </span>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const [periodo, setPeriodo] = useState<Periodo>("365");
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [osId, setOsId] = useState<string | null>(null);
  const [nome, setNome] = useState<string>("");

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
    const dias = periodo === "hoje" ? 1 : Number(periodo);
    const inicioAnt = new Date(inicio); inicioAnt.setDate(inicioAnt.getDate() - dias);
    const inicioAntIso = inicioAnt.toISOString();
    try {
      const r = await Promise.allSettled([
        supabase.from("financeiro").select("valor, tipo, data_transacao").eq("organization_id", orgId).gte("data_transacao", todayDateInput(inicio)),
        supabase.from("vendas").select("id, numero, cliente_nome, valor_total, status_pagamento, data_venda, criado_em").eq("organization_id", orgId).gte("criado_em", inicioIso).order("criado_em", { ascending: false }),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("clientes").select("id, created_at").eq("organization_id", orgId).gte("created_at", inicioIso),
        supabase.from("ordens_servico").select("id, numero, status, tecnico_id, created_at, data_conclusao, tipo_equipamento, modelo_equipamento, clientes(nome)").eq("organization_id", orgId).gte("created_at", inicioIso).order("created_at", { ascending: false }),
        supabase.from("itens_estoque").select("quantidade, estoque_minimo").eq("organization_id", orgId),
        supabase.from("ordens_servico").select("id, numero, clientes(nome)").eq("organization_id", orgId).not("data_previsao", "is", null).lt("data_previsao", hoje).not("status", "in", `(${ENCERRADAS.join(",")})`).order("data_previsao").limit(5),
        supabase.from("profiles").select("id, nome").eq("organization_id", orgId),
        fetchOsComValores(orgId),
        supabase.from("financeiro").select("valor, tipo").eq("organization_id", orgId).gte("data_transacao", todayDateInput(inicioAnt)).lt("data_transacao", todayDateInput(inicio)),
        supabase.from("vendas").select("valor_total").eq("organization_id", orgId).gte("criado_em", inicioAntIso).lt("criado_em", inicioIso),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", inicioAntIso).lt("created_at", inicioIso),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", inicioAntIso).lt("created_at", inicioIso),
      ]);
      const v = (i: number): any => (r[i].status === "fulfilled" ? (r[i] as PromiseFulfilledResult<any>).value : null);
      r.forEach((x, i) => x.status === "rejected" && console.error(`Dashboard consulta ${i}:`, x.reason));

      const fin: any[] = v(0)?.data || [];
      const vendas: any[] = v(1)?.data || [];
      const os: any[] = v(4)?.data || [];
      const meuNome = (v(7)?.data || []).find((p: any) => p.id === user?.id)?.nome;
      if (meuNome) setNome(String(meuNome).split(" ")[0]);
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
        const k = chave(parseDate(data));
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

      const finAnt: any[] = v(9)?.data || [];
      const receitaAnt = finAnt.filter(f => f.tipo === "receita").reduce((a, f) => a + Number(f.valor || 0), 0)
        + (v(10)?.data || []).reduce((a: number, s: any) => a + Number(s.valor_total || 0), 0);
      const despesaAnt = finAnt.filter(f => f.tipo === "despesa").reduce((a, f) => a + Number(f.valor || 0), 0);
      const chavesSerie = Array.from(buckets.keys());
      const contarPor = (lista: any[]) => {
        const m = new Map(chavesSerie.map(k => [k, 0]));
        lista.forEach(x => { const k = chave(new Date(x.created_at)); if (m.has(k)) m.set(k, (m.get(k) || 0) + 1); });
        return cincoBarras(Array.from(m.values()));
      };
      const clientesNovosLista: any[] = v(3)?.data || [];

      setDados({
        anterior: { receita: receitaAnt, lucro: receitaAnt - despesaAnt, os: v(11)?.count || 0, clientes: v(12)?.count || 0 },
        barras: { receita: cincoBarras(Array.from(buckets.values())), os: contarPor(os), clientes: contarPor(clientesNovosLista) },
        receita: receitaFin + osFaturadasPeriodo + vendasTotal,
        despesas,
        vendasTotal,
        vendasQtd: vendas.length,
        clientesTotal: v(2)?.count || 0,
        clientesNovos: clientesNovosLista.length,
        osTotal: os.length,
        osConcluidas: os.filter(o => FINALIZADAS.includes(o.status)).length,
        aReceber: osValores.filter(o => !o.pago && o.valor > 0).reduce((a, o) => a + o.valor, 0)
          + vendasPendentes.reduce((a, s) => a + Number(s.valor_total || 0), 0),
        aReceberQtd: osValores.filter(o => !o.pago && o.valor > 0).length + vendasPendentes.length,
        estoqueBaixo: (v(5)?.data || []).filter((i: any) => Number(i.quantidade) <= Number(i.estoque_minimo)).length,
        serie: Array.from(buckets, ([data, receita]) => ({ data, receita })),
        tecnicos: Array.from(porTec, ([nome, n]) => ({ nome, os: n })).sort((a, b) => b.os - a.os).slice(0, 8),
        statusOS: Array.from(porStatus, ([name, value]) => ({ name, value })),
        osRecentes: os.slice(0, 5).map(o => ({ ...o, tecnico_nome: o.tecnico_id ? perfis.get(o.tecnico_id) : null, valor: osValores.find(x => x.id === o.id)?.valor ?? null })),
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

  const saudacao = (() => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; })();
  const atividades = dados ? [
    ...dados.osRecentes.map(o => ({ id: `os-${o.id}`, icon: Wrench, titulo: `Nova OS #${o.numero}`, sub: o.clientes?.nome || "Cliente", data: o.created_at, onClick: () => setOsId(o.id) })),
    ...dados.vendasRecentes.map(v => ({ id: `v-${v.id}`, icon: ShoppingCart, titulo: "Venda realizada", sub: `${v.cliente_nome || "Consumidor"} • ${formatCurrency(Number(v.valor_total || 0))}`, data: v.criado_em, onClick: () => navigate("/vendas") })),
  ].sort((x, y) => new Date(y.data).getTime() - new Date(x.data).getTime()).slice(0, 5) : [];
  const kpis = dados ? [
    { label: "Receita Total", value: formatCurrency(dados.receita), delta: variacao(dados.receita, dados.anterior.receita), bars: dados.barras.receita, icon: DollarSign, href: "/financeiro", tone: "primary" },
    { label: "Lucro Operacional", value: formatCurrency(lucro), delta: variacao(lucro, dados.anterior.lucro), bars: dados.barras.receita, icon: BarChart3, href: "/financeiro", tone: "primary" },
    { label: "Ordens em Andamento", value: String(dados.osTotal - dados.osConcluidas), delta: variacao(dados.osTotal, dados.anterior.os), bars: dados.barras.os, icon: Wrench, href: "/ordens-servico", tone: "warning" },
    { label: "Clientes Ativos", value: String(dados.clientesTotal), delta: variacao(dados.clientesNovos, dados.anterior.clientes), bars: dados.barras.clientes, icon: Users, href: "/clientes", tone: "primary" },
  ] : [];
  const serieAcumulada = (() => {
    if (!dados?.serie.length) return [];
    let acc = 0;
    const acum = dados.serie.map(p => (acc += p.receita));
    const passo = Math.max(1, Math.ceil(acum.length / 8));
    const pts = acum.filter((_, i) => i % passo === 0);
    if (pts[pts.length - 1] !== acum[acum.length - 1]) pts.push(acum[acum.length - 1]);
    return pts.map(receita => ({ receita }));
  })();
  const pieData = dados ? [
    { name: "Entradas", value: Math.max(dados.receita, 0) },
    { name: "Saídas", value: Math.max(dados.despesas, 0) },
  ] : [];

  return (
    <MainLayout>
      <div className="space-y-5 lg:space-y-6 lg:py-2" data-tour="dashboard-content">
        {/* Saudação — no celular fica sobre a faixa verde */}
        <section className="relative -mx-3 -mt-4 overflow-hidden bg-sidebar px-5 pb-16 pt-1 text-sidebar-accent-foreground sm:-mx-6 lg:hidden">
          <h1 className="relative z-10 text-[1.7rem] font-bold leading-tight">Olá{nome ? `, ${nome.charAt(0).toUpperCase()}${nome.slice(1).toLowerCase()}` : ""}!</h1>
          <p className="relative z-10 mt-1 text-[15px] opacity-90">Aqui está o resumo das suas operações</p>
          <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden>
            <path d="M0 80 L0 66 C 120 74, 200 30, 300 14 C 340 8, 380 10, 400 14 L400 80 Z" fill="hsl(var(--primary-glow) / 0.55)" />
            <path d="M0 80 L0 72 C 130 80, 210 42, 300 26 C 345 18, 380 20, 400 24 L400 80 Z" fill="hsl(var(--background))" />
          </svg>
        </section>
        <div className="relative z-10 !mt-[-3.25rem] flex h-[68px] w-full items-center gap-2 rounded-full bg-card px-2.5 shadow-lg lg:hidden">
          <button type="button" onClick={openGlobalSearch} className="flex flex-1 items-center gap-2" aria-label="Buscar no sistema">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted"><Search className="h-5 w-5 text-muted-foreground" /></span>
            <span className="flex h-11 flex-1 items-center rounded-full bg-muted px-4 text-left text-[15px] text-muted-foreground">Buscar no sistema...</span>
          </button>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="h-11 w-11 shrink-0 justify-center rounded-full border-0 bg-muted p-0 [&>svg:last-child]:hidden" aria-label="Filtrar período">
              <SlidersHorizontal className="h-5 w-5 text-foreground" />
            </SelectTrigger>
            <SelectContent align="end">{PERIODOS.map(p => <SelectItem key={p.id} value={p.id}>{p.id === "hoje" ? "Hoje" : `Últimos ${p.label}`}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="hidden flex-col gap-4 lg:flex xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground">Visão geral</h1>
            <p className="mt-1 text-muted-foreground">{saudacao}{nome ? `, ${nome}` : ""}! Acompanhe o desempenho e a operação da sua empresa.</p>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-2">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="h-11 w-[170px] rounded-xl bg-card shadow-sm" aria-label="Período"><CalendarDays className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODOS.map(p => <SelectItem key={p.id} value={p.id}>{p.id === "hoje" ? "Hoje" : `Últimos ${p.label}`}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl bg-card" aria-label="Atualizar" onClick={() => organization?.id && carregar(organization.id)}><RefreshCw className="h-4 w-4" /></Button>
            <Button className="h-11 gap-2 rounded-xl" onClick={() => navigate("/ordens-servico")}><Wrench className="h-4 w-4" />Nova OS</Button>
            <Button className="h-11 gap-2 rounded-xl" onClick={() => navigate("/pdv")}><ShoppingCart className="h-4 w-4" />Nova venda</Button>
          </div>
        </div>

        {(loading || orgLoading) && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        )}

        {dados && !loading && (
          <>
            {/* Indicadores */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
              {kpis.map((k, idx) => (
                <button key={k.label} onClick={() => navigate(k.href)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-3 pb-12 text-left shadow-sm transition-shadow hover:shadow-md sm:p-5 sm:pb-14">
                  <div className="relative z-10 flex items-start gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12", k.tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary")}>
                      <k.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold leading-tight text-foreground sm:text-[15px]">{k.label}</p>
                      <p className="mt-1 truncate text-[17px] font-bold tracking-tight text-foreground sm:text-[26px]">{k.value}</p>
                      <span className={cn("mt-1 flex items-center gap-0.5 text-[12px] font-bold sm:text-[13px]", k.delta != null && k.delta < 0 ? "text-destructive" : "text-primary")}>
                        {k.delta == null ? <span className="font-medium text-muted-foreground">—</span> : (
                          <>{k.delta < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}{Math.abs(k.delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%<span className="ml-1 hidden font-normal text-muted-foreground sm:inline">vs período anterior</span></>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14" aria-hidden>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={k.bars.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                        <defs>
                          <linearGradient id={`spark-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={k.tone === "warning" ? "hsl(var(--warning))" : "hsl(var(--primary-glow))"} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={k.tone === "warning" ? "hsl(var(--warning))" : "hsl(var(--primary-glow))"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke={k.tone === "warning" ? "hsl(var(--warning))" : "hsl(var(--primary-glow))"} strokeWidth={2} fill={`url(#spark-${idx})`} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
              {/* Faturamento: cartão verde no celular, gráfico completo no computador */}
              <section className="relative overflow-hidden rounded-2xl p-5 text-sidebar-accent-foreground shadow-md lg:hidden" style={{ background: "var(--gradient-brand)" }}>
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-5 w-5" />Faturamento</p>
                  <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                    <SelectTrigger className="h-8 w-auto gap-1 rounded-full border-0 bg-sidebar-accent/70 px-3 text-xs text-sidebar-accent-foreground" aria-label="Período"><SelectValue /></SelectTrigger>
                    <SelectContent align="end">{PERIODOS.map(p => <SelectItem key={p.id} value={p.id}>{p.id === "hoje" ? "Hoje" : `Últimos ${p.label}`}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="relative z-10 mt-3 text-[2rem] font-bold leading-none tracking-tight">{formatCurrency(dados.receita)}</p>
                <p className="relative z-10 mt-2 flex max-w-[55%] items-center gap-1 text-xs opacity-90">
                  {(() => { const d = variacao(dados.receita, dados.anterior.receita); return d == null ? "Sem base no período anterior" : <><span className="flex items-center font-bold">{d < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}{Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span> em relação ao período anterior</>; })()}
                </p>
                <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-[62%]" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={serieAcumulada} margin={{ top: 8, bottom: 0, left: 0, right: 6 }}>
                      <defs>
                        <linearGradient id="gFatMobile" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="receita" stroke="hsl(var(--primary-foreground) / 0.85)" strokeWidth={2}
                        fill="url(#gFatMobile)" dot={{ r: 3, fill: "hsl(var(--primary-foreground))", stroke: "none" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-6" />
              </section>

              <section className="hidden rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2 lg:block">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-6 w-6 text-foreground" />
                    <div><h2 className="text-lg font-bold">Faturamento e Evolução</h2><p className="text-sm text-muted-foreground">Receita {periodo === "hoje" ? "de hoje" : `dos últimos ${periodoLabel}`}</p></div>
                  </div>
                  <div className="flex gap-1 rounded-full border border-border p-1">
                    {PERIODOS.filter(p => p.id !== "hoje").map(p => (
                      <Button key={p.id} size="sm" variant={periodo === p.id ? "default" : "ghost"} className="h-8 rounded-full" onClick={() => setPeriodo(p.id)}>{p.label}</Button>
                    ))}
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dados.serie} margin={{ left: 0, right: 12, top: 12 }}>
                      <defs>
                        <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary-glow))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="data" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={64} tickFormatter={(n) => `R$ ${Number(n) >= 1000 ? `${Math.round(n / 1000)}k` : n}`} />
                      <Tooltip formatter={(n: number) => formatCurrency(n)} contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gReceita)" dot={dados.serie.length <= 31 ? { r: 3, fill: "hsl(var(--primary))" } : false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Resumo financeiro */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><PieIcon className="h-5 w-5 text-primary" />Resumo Financeiro</h2>
                  <Button variant="link" size="sm" className="px-0" onClick={() => navigate("/financeiro")}>Ver detalhes<ArrowRight className="ml-1 h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-2 items-center gap-4 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="relative mx-auto aspect-square w-full max-w-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData.some(p => p.value > 0) ? pieData : [{ name: "Sem dados", value: 1 }]} dataKey="value" innerRadius="70%" outerRadius="100%" stroke="none" startAngle={90} endAngle={-270}>
                          {(pieData.some(p => p.value > 0) ? pieData : [{}]).map((_, i) => <Cell key={i} fill={!pieData.some(p => p.value > 0) ? "hsl(var(--muted))" : i === 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-base font-bold sm:text-xl">{compacto(dados.receita)}</span>
                      <span className="text-xs text-muted-foreground">Total</span>
                    </div>
                  </div>
                  <ul className="space-y-3 text-sm">
                    <li><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Entradas</span><span className="block font-bold">{formatCurrency(dados.receita)}</span></li>
                    <li><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-destructive" />Saídas</span><span className="block font-bold">{formatCurrency(dados.despesas)}</span></li>
                    <li className="rounded-xl bg-primary/10 p-2.5"><span className="text-xs text-muted-foreground">Resultado</span><span className={cn("block text-base font-bold", lucro < 0 ? "text-destructive" : "text-primary")}>{formatCurrency(lucro)}</span></li>
                  </ul>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Margem Operacional</span><span>{margem}%</span>
                </div>
              </section>
            </div>

            {/* Alertas */}
            {totalAlertas > 0 && (
              <section className="space-y-2 rounded-2xl border border-destructive/30 bg-card p-4 shadow-sm">
                <h2 className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Requer atenção ({totalAlertas})</h2>
                {dados.osAtrasadas.map(o => (
                  <button key={o.id} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => setOsId(o.id)}>
                    <span><span className="font-mono">OS {o.numero}</span> em atraso — {o.clientes?.nome || "Cliente"}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {dados.estoqueBaixo > 0 && (
                  <button className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => navigate("/compras")}>
                    <span className="flex items-center gap-2"><Package className="h-4 w-4" />{dados.estoqueBaixo} item(ns) com estoque baixo</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </section>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
              {/* Ordens recentes */}
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2 lg:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold"><Wrench className="h-5 w-5" />Ordens de Serviço Recentes</h2>
                  <Button variant="link" size="sm" className="px-0" onClick={() => navigate("/ordens-servico")}>Ver todas<ArrowRight className="ml-1 h-4 w-4" /></Button>
                </div>
                {dados.osRecentes.length === 0 ? <Vazio texto="Nenhuma OS no período" /> : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 font-medium">Nº OS</th><th className="font-medium">Cliente</th><th className="font-medium">Equipamento</th><th className="font-medium">Técnico</th><th className="font-medium">Status</th><th className="font-medium">Data</th><th className="text-right font-medium">Valor</th>
                        </tr></thead>
                        <tbody>
                          {dados.osRecentes.map(o => (
                            <tr key={o.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50" onClick={() => setOsId(o.id)}>
                              <td className="py-3 font-mono font-medium">#{o.numero}</td>
                              <td className="max-w-[180px] truncate">{o.clientes?.nome || "—"}</td>
                              <td className="max-w-[160px] truncate">{[o.tipo_equipamento, o.modelo_equipamento].filter(Boolean).join(" ") || "—"}</td>
                              <td>{o.tecnico_nome || "—"}</td>
                              <td><span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusTone(o.status))}>{STATUS_LABEL[o.status] || o.status}</span></td>
                              <td>{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                              <td className="text-right font-medium">{o.valor != null ? formatCurrency(o.valor) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <table className="w-full table-fixed text-[13px] md:hidden">
                      <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="w-[22%] py-2 font-medium">#OS</th><th className="w-[30%] font-medium">Cliente</th><th className="font-medium">Status</th><th className="w-[24%] font-medium">Data</th>
                      </tr></thead>
                      <tbody>
                        {dados.osRecentes.map(o => (
                          <tr key={o.id} className="cursor-pointer border-b border-border last:border-0" onClick={() => setOsId(o.id)}>
                            <td className="truncate py-3 font-medium">#{o.numero}</td>
                            <td className="truncate pr-1">{o.clientes?.nome || "—"}</td>
                            <td className="pr-1"><span className={cn("inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone(o.status))}>{STATUS_LABEL[o.status] || o.status}</span></td>
                            <td className="text-xs"><span className="flex items-center justify-between">{new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}<ChevronRight className="h-4 w-4 text-muted-foreground" /></span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>

              {/* Atividades recentes */}
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Zap className="h-5 w-5" />Atividades Recentes</h2>
                {atividades.length === 0 ? <Vazio texto="Nenhuma atividade no período" /> : (
                  <ol className="relative space-y-1 border-l-2 border-primary/30 pl-4">
                    {atividades.map(a => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-primary bg-card" />
                        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted" onClick={a.onClick}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><a.icon className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{a.titulo}</span>
                            <span className="block truncate text-xs text-muted-foreground">{tempoRelativo(a.data)} • {a.sub}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}

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

function compacto(n: number) {
  return n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : formatCurrency(n);
}

function tempoRelativo(d: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

function Vazio({ texto }: { texto: string }) {
  return <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">{texto}</div>;
}

export default Index;
