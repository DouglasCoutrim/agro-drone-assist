import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Package, DollarSign, AlertTriangle, CheckCircle, Plus, Eye, Clock, ClipboardList
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

const TIPO_EQUIPAMENTO: Record<string, string> = {
  drone_agricola: "Drone Agrícola", drone_convencional: "Drone de Consumo",
  controle: "Controle", bateria: "Bateria", outro: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  recebido: { label: "Recebido", className: "bg-vc-amber-light text-vc-amber-text" },
  aguardando_diagnostico: { label: "Aguard. Diagnóstico", className: "bg-vc-slate-light text-vc-slate-text" },
  aguardando_aprovacao: { label: "Aguard. Aprovação", className: "bg-vc-slate-light text-vc-slate-text" },
  aprovado: { label: "Aprovado", className: "bg-vc-blue-light text-vc-blue-text" },
  em_reparo: { label: "Em Reparo", className: "bg-vc-blue-light text-vc-blue-text" },
  em_testes: { label: "Em Testes", className: "bg-vc-blue-light text-vc-blue-text" },
  pronto_retirada: { label: "Pronto p/ Retirada", className: "bg-vc-green-light text-vc-green-text" },
  entregue: { label: "Entregue", className: "bg-vc-slate-light text-vc-slate-text opacity-70" },
  cancelada: { label: "Cancelado", className: "bg-vc-red-light text-vc-red-text" },
  aberta: { label: "Aberta", className: "bg-vc-amber-light text-vc-amber-text" },
  em_andamento: { label: "Em Andamento", className: "bg-vc-blue-light text-vc-blue-text" },
  aguardando_peca: { label: "Aguardando Peça", className: "bg-vc-slate-light text-vc-slate-text" },
  concluida: { label: "Concluída", className: "bg-vc-green-light text-vc-green-text" },
};

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPlatformAdmin, loading: orgLoading } = useOrganization();
  const [stats, setStats] = useState({ osAbertas: 0, osConcluidas: 0, itensEstoqueBaixo: 0, totalClientes: 0, faturamentoMes: 0 });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [overdueOS, setOverdueOS] = useState<any[]>([]);
  const [overduePayments, setOverduePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingOS, setViewingOS] = useState<any | null>(null);

  useEffect(() => {
    // Only redirect if we are specifically at the index/dashboard route
    // and if the user is a platform admin.
    if (user && !orgLoading && isPlatformAdmin && window.location.pathname === "/dashboard") {
      navigate("/admin-master", { replace: true });
    }
  }, [user, isPlatformAdmin, orgLoading, navigate]);

  useEffect(() => { if (user) fetchDashboardData(); }, [user]);

  const fetchDashboardData = async () => {
    try {
      const { data: osAbertas } = await supabase.from("ordens_servico").select("id", { count: "exact" }).in("status", ["aberta", "em_andamento", "aguardando_peca", "recebido", "aguardando_diagnostico", "aguardando_aprovacao"]);
      const { data: osConcluidas } = await supabase.from("ordens_servico").select("id", { count: "exact" }).in("status", ["concluida", "pronto_retirada", "entregue"]);
      const { data: itensEstoque } = await supabase.from("itens_estoque").select("*");
      const itensEstoqueBaixo = itensEstoque?.filter(item => item.quantidade <= item.estoque_minimo).length || 0;
      const { count: totalClientes } = await supabase.from("clientes").select("*", { count: "exact", head: true });
      const { data: recentOSData } = await supabase.from("ordens_servico").select("*, clientes (nome, telefone)").order("created_at", { ascending: false }).limit(5);
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      const { data: receitas } = await supabase.from("financeiro").select("valor").eq("tipo", "receita").gte("data_transacao", startOfMonth.toISOString());
      const faturamentoMes = receitas?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

      const today = new Date().toISOString();
      const { data: overdueOSData } = await supabase
        .from("ordens_servico").select("*, clientes (nome, telefone)")
        .not("data_previsao", "is", null).lt("data_previsao", today)
        .not("status", "in", '("entregue","cancelada","pronto_retirada","concluida")')
        .order("data_previsao", { ascending: true }).limit(10);

      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const res = await fetch(`https://${projectId}.supabase.co/functions/v1/asaas?action=list_payments&status=OVERDUE`, { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } });
          const result = await res.json();
          setOverduePayments(result?.data || []);
        }
      } catch { /* silent */ }

      setStats({ osAbertas: osAbertas?.length || 0, osConcluidas: osConcluidas?.length || 0, itensEstoqueBaixo, totalClientes: totalClientes || 0, faturamentoMes });
      setRecentOS(recentOSData || []);
      setOverdueOS(overdueOSData || []);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${config.className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
        {config.label}
      </span>
    );
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

  return (
    <MainLayout>
      <div className="space-y-6" data-tour="dashboard-content">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground leading-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Visão geral da oficina</p>
          </div>
          <Button className="gradient-primary hidden lg:inline-flex" onClick={() => navigate("/ordens-servico")}>
            <Plus className="mr-1.5 h-4 w-4" />Nova OS
          </Button>
        </div>

        {/* KPI Grid */}
        {loading ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="OS Abertas" value={stats.osAbertas} icon={ClipboardList} color="amber" onClick={() => navigate("/ordens-servico")} />
            <KpiCard label="Concluídas" value={stats.osConcluidas} icon={CheckCircle} color="green" onClick={() => navigate("/ordens-servico")} />
            <KpiCard label="Estoque Baixo" value={stats.itensEstoqueBaixo} icon={AlertTriangle} color="red" onClick={() => navigate("/estoque")} />
            <KpiCard label="Faturamento" value={formatCurrency(stats.faturamentoMes)} icon={DollarSign} color="blue" onClick={() => navigate("/financeiro")} />
          </div>
        )}

        {/* Main Grid */}
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          {/* Recent OS */}
          <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <h3 className="font-display text-[15px] font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />OS Recentes
              </h3>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : recentOS.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-background flex items-center justify-center text-muted-foreground">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="text-[15px] font-semibold text-foreground">Nenhuma OS encontrada</p>
                  <p className="text-[13px] text-muted-foreground max-w-[280px] text-center leading-relaxed">Crie sua primeira Ordem de Serviço</p>
                  <Button variant="outline" size="sm" onClick={() => navigate("/ordens-servico")}>Criar primeira OS</Button>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-background border-b border-border whitespace-nowrap">#</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-background border-b border-border whitespace-nowrap">Cliente</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-background border-b border-border whitespace-nowrap">Equipamento</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-background border-b border-border whitespace-nowrap">Status</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground bg-background border-b border-border whitespace-nowrap" />
                        </tr>
                      </thead>
                      <tbody>
                        {recentOS.map(os => (
                          <tr key={os.id} className="hover:bg-background transition-colors cursor-pointer" onClick={() => setViewingOS(os)}>
                            <td className="px-4 py-3 border-b border-border-subtle">
                              <span className="font-mono text-[13px] text-vc-green-text font-medium">{os.numero}</span>
                            </td>
                            <td className="px-4 py-3 border-b border-border-subtle text-sm text-foreground">{os.clientes?.nome || "Cliente"}</td>
                            <td className="px-4 py-3 border-b border-border-subtle text-sm text-foreground">{TIPO_EQUIPAMENTO[os.tipo_equipamento] || os.tipo_equipamento}</td>
                            <td className="px-4 py-3 border-b border-border-subtle">{getStatusBadge(os.status)}</td>
                            <td className="px-4 py-3 border-b border-border-subtle text-right">
                              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground hover:border-border border border-transparent transition-all">
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {recentOS.map(os => {
                      const statusKey = os.status;
                      const borderColor = statusKey.includes("reparo") || statusKey.includes("teste") ? "border-l-vc-blue"
                        : statusKey.includes("pronto") || statusKey === "concluida" ? "border-l-primary"
                        : statusKey === "cancelada" ? "border-l-destructive"
                        : "border-l-warning";
                      return (
                        <div
                          key={os.id}
                          className={`bg-card border border-border rounded-xl p-3.5 border-l-4 ${borderColor} transition-all hover:shadow-soft cursor-pointer`}
                          onClick={() => setViewingOS(os)}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-xs text-vc-green-text font-medium">{os.numero}</span>
                            {getStatusBadge(os.status)}
                          </div>
                          <p className="text-sm font-medium text-foreground mb-1">{os.clientes?.nome || "Cliente"}</p>
                          <p className="text-xs text-muted-foreground">{TIPO_EQUIPAMENTO[os.tipo_equipamento] || os.tipo_equipamento}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Alerts column */}
          <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <h3 className="font-display text-[15px] font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />Alertas
              </h3>
            </div>
            <div className="p-5 space-y-2">
              {overdueOS.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive bg-vc-red-light text-vc-red-text text-[13px] cursor-pointer" onClick={() => navigate("/ordens-servico")}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{overdueOS.length} OS em Atraso</p>
                    {overdueOS.slice(0, 2).map(os => (
                      <p key={os.id} className="text-xs mt-0.5 opacity-80">• {os.numero} - {os.clientes?.nome || "N/A"}</p>
                    ))}
                  </div>
                </div>
              )}
              {overduePayments.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive bg-vc-red-light text-vc-red-text text-[13px] cursor-pointer" onClick={() => navigate("/cobrancas")}>
                  <DollarSign className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{overduePayments.length} Cobranças Vencidas</p>
                    <p className="text-xs font-medium mt-0.5">
                      Total: {formatCurrency(overduePayments.reduce((a: number, p: any) => a + (p?.value || 0), 0))}
                    </p>
                  </div>
                </div>
              )}
              {stats.itensEstoqueBaixo > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-warning bg-vc-amber-light text-vc-amber-text text-[13px] cursor-pointer" onClick={() => navigate("/estoque")}>
                  <Package className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{stats.itensEstoqueBaixo} Itens com Estoque Baixo</p>
                  </div>
                </div>
              )}
              {overdueOS.length === 0 && overduePayments.length === 0 && stats.itensEstoqueBaixo === 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-primary bg-vc-green-light text-vc-green-text text-[13px]">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="font-medium">Tudo em dia!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FAB mobile */}
        <button
          className="fixed bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+16px)] right-5 w-[52px] h-[52px] rounded-full bg-primary text-primary-foreground flex items-center justify-center z-[90] transition-all hover:bg-vc-green-hover hover:scale-105 lg:hidden"
          style={{ boxShadow: "0 4px 16px rgba(22,163,74,0.40)" }}
          onClick={() => navigate("/ordens-servico")}
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* View OS Dialog */}
        <Dialog open={!!viewingOS} onOpenChange={(open) => { if (!open) setViewingOS(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base font-display">
                <span>OS {viewingOS?.numero}</span>
                {viewingOS && getStatusBadge(viewingOS.status)}
              </DialogTitle>
              <DialogDescription className="text-xs">Visualização rápida</DialogDescription>
            </DialogHeader>
            {viewingOS && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Cliente</p><p className="text-sm font-medium">{viewingOS.clientes?.nome || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Equipamento</p><p className="text-sm">{TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Modelo</p><p className="text-sm">{viewingOS.modelo_equipamento || "-"}</p></div>
                  <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                  <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Defeito</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setViewingOS(null); navigate("/ordens-servico"); }}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />Ver Completa
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Index;
