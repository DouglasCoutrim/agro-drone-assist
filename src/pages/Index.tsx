import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Package, DollarSign, AlertTriangle, CheckCircle, Plus, Eye, Clock, ClipboardList, Wrench
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { fetchOsComValores } from "@/lib/os-billing";
import { PremiumCard, KpiCard, PremiumTable, AlertBox } from "@/components/premium";

const TIPO_EQUIPAMENTO: Record<string, string> = {
  drone_agricola: "Drone Agrícola",
  drone_convencional: "Drone de Consumo",
  controle: "Controle",
  bateria: "Bateria",
  outro: "Outro",
  carregador: "Carregador",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  recebido: { label: "Recebido", color: "yellow" },
  aguardando_diagnostico: { label: "Aguard. Diagnóstico", color: "slate" },
  aguardando_aprovacao: { label: "Aguard. Aprovação", color: "slate" },
  aprovado: { label: "Aprovado", color: "blue" },
  em_reparo: { label: "Em Reparo", color: "blue" },
  em_testes: { label: "Em Testes", color: "yellow" },
  pronto_retirada: { label: "Pronto p/ Retirada", color: "green" },
  finalizada: { label: "Finalizada", color: "green" },
  entregue: { label: "Entregue", color: "slate" },
  cancelada: { label: "Cancelado", color: "red" },
  aberta: { label: "Aberta", color: "yellow" },
  em_andamento: { label: "Em Andamento", color: "blue" },
  aguardando_peca: { label: "Aguardando Peça", color: "slate" },
  concluida: { label: "Concluída", color: "green" },
};

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, isPlatformAdmin, loading: orgLoading } = useOrganization();
  const [stats, setStats] = useState({
    osAbertas: 0,
    osConcluidas: 0,
    itensEstoqueBaixo: 0,
    totalClientes: 0,
    faturamentoMes: 0,
    aReceber: 0,
  });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [overdueOS, setOverdueOS] = useState<any[]>([]);
  const [overduePayments, setOverduePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingOS, setViewingOS] = useState<any | null>(null);

  useEffect(() => {
    if (orgLoading) return;
    if (!organization?.id) {
      setLoading(false);
      return;
    }
    if (user) fetchDashboardData();
  }, [user, organization?.id, orgLoading, isPlatformAdmin]);

  const fetchDashboardData = async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }
    const orgId = organization.id;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const today = new Date().toISOString();

    try {
      const results = await Promise.allSettled([
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("organization_id", orgId).in("status", ["aberta", "em_andamento", "aguardando_peca", "recebido", "aguardando_diagnostico", "aguardando_aprovacao"]),
        supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("organization_id", orgId).in("status", ["concluida", "pronto_retirada", "entregue", "finalizada"]),
        supabase.from("itens_estoque").select("quantidade, estoque_minimo").eq("organization_id", orgId),
        supabase.from("clientes").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("ordens_servico").select("*, clientes(nome, telefone)").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(5),
        supabase.from("financeiro").select("valor").eq("organization_id", orgId).eq("tipo", "receita").gte("data_transacao", startOfMonth.toISOString()),
        supabase.from("ordens_servico").select("*, clientes(nome, telefone)").eq("organization_id", orgId).not("data_previsao", "is", null).lt("data_previsao", today).not("status", "in", "(entregue,cancelada,pronto_retirada,concluida,finalizada)").order("data_previsao", { ascending: true }).limit(10),
        supabase.from("empresa_config").select("gateway_clientes, gateway_clientes_credentials").eq("organization_id", orgId).maybeSingle(),
      ]);

      const get = (i: number): any => results[i].status === "fulfilled" ? (results[i] as any).value : { data: [], count: 0, error: (results[i] as any).reason };
      const osAbertasRes = get(0);
      const osConcluidasRes = get(1);
      const itensEstoqueRes = get(2);
      const totalClientesRes = get(3);
      const recentOSRes = get(4);
      const receitasRes = get(5);
      const overdueOSRes = get(6);
      const gatewayConfigRes = get(7);

      results.forEach((r, i) => {
        if (r.status === "rejected") console.error(`Dashboard query ${i} failed:`, r.reason);
        else if ((r.value as any)?.error) console.error(`Dashboard query ${i} error:`, (r.value as any).error);
      });

      const itensEstoqueBaixo = (itensEstoqueRes.data || []).filter((item: any) => item.quantidade <= item.estoque_minimo).length;
      const receitasLancadas = (receitasRes.data || []).reduce((acc: number, r: any) => acc + Number(r.valor), 0);

      let faturamentoMes = receitasLancadas;
      let aReceber = 0;
      try {
        const osValores = await fetchOsComValores(orgId);
        const finalizadas = ["concluida", "pronto_retirada", "entregue", "finalizada"];
        faturamentoMes += osValores
          .filter(o => !o.pago && o.valor > 0 && finalizadas.includes(o.status))
          .filter(o => {
            const ref = o.data_entrega || o.data_conclusao;
            return ref ? new Date(ref) >= startOfMonth : false;
          })
          .reduce((acc, o) => acc + o.valor, 0);
        aReceber = osValores.filter(o => !o.pago && o.valor > 0).reduce((acc, o) => acc + o.valor, 0);
      } catch (e) {
        console.error("Erro ao calcular valores de OS:", e);
      }

      const gatewayCredentials = gatewayConfigRes.data?.gateway_clientes_credentials;
      const hasAsaasCredentials = gatewayCredentials
        && typeof gatewayCredentials === "object"
        && !Array.isArray(gatewayCredentials)
        && typeof gatewayCredentials.api_key === "string"
        && gatewayCredentials.api_key.length > 0;

      setStats({
        osAbertas: osAbertasRes.count || 0,
        osConcluidas: osConcluidasRes.count || 0,
        itensEstoqueBaixo,
        totalClientes: totalClientesRes.count || 0,
        faturamentoMes,
        aReceber,
      });
      setRecentOS(recentOSRes.data || []);
      setOverdueOS(overdueOSRes.data || []);
      setOverduePayments([]);
      if (gatewayConfigRes.data?.gateway_clientes === "asaas" && hasAsaasCredentials) {
        void supabase.functions.invoke('asaas', {
          body: { action: 'list_payments', status: 'OVERDUE' },
        }).then(({ data: result, error }) => {
          if (!error) setOverduePayments(result?.data || []);
        }).catch((error) => console.error("Erro ao consultar pagamentos em atraso:", error));
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, color: "slate" };
    const colorMap: Record<string, string> = {
      yellow: "bg-yellow-50 text-yellow-700",
      slate: "bg-slate-50 text-slate-700",
      blue: "bg-blue-50 text-blue-700",
      green: "bg-green-50 text-green-700",
      red: "bg-red-50 text-red-700",
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorMap[config.color] || "bg-slate-50 text-slate-700"}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
        {config.label}
      </span>
    );
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

  // Transform data for PremiumTable
  const recentOSData = recentOS.map(os => ({
    id: os.id,
    numero: os.numero,
    cliente: os.clientes?.nome || "Cliente",
    equipamento: TIPO_EQUIPAMENTO[os.tipo_equipamento] || os.tipo_equipamento,
    status: os.status,
    originalData: os,
  }));

  const recentOSColumns = [
    { key: "numero", label: "#", width: "w-[80px]" },
    { key: "cliente", label: "Cliente", width: "flex-1" },
    { key: "equipamento", label: "Equipamento", width: "w-[150px]" },
    { key: "status", label: "Status", width: "w-[140px]" },
    { key: "acao", label: "", width: "w-[50px]" },
  ];

  const renderOSCell = (item: any, key: string) => {
    if (key === "status") {
      return getStatusBadge(item.status);
    }
    if (key === "acao") {
      return (
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Visualizar OS" onClick={(e) => { e.stopPropagation(); setViewingOS(item.originalData); }}>
          <Eye className="h-3.5 w-3.5 text-gray-500" />
        </Button>
      );
    }
    return item[key];
  };

  return (
    <MainLayout>
      <div className="space-y-8 py-8" data-tour="dashboard-content">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full">
            <h1 className="text-3xl font-bold text-gray-900 font-display leading-tight">Dashboard</h1>
            <p className="text-gray-600 mt-1">Visão geral da sua oficina e operações em tempo real</p>
          </div>
          <Button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold" onClick={() => navigate("/ordens-servico")}>
            + Nova OS
          </Button>
        </div>

        {/* KPI Grid */}
        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <KpiCard label="OS Abertas" value={stats.osAbertas} icon={ClipboardList} color="blue" onClick={() => navigate("/ordens-servico")} delay={0} />
            <KpiCard label="Concluídas" value={stats.osConcluidas} icon={CheckCircle} color="green" onClick={() => navigate("/ordens-servico")} delay={100} />
            <KpiCard label="Estoque Baixo" value={stats.itensEstoqueBaixo} icon={Package} color="yellow" onClick={() => navigate("/estoque")} delay={200} />
            <KpiCard label="Faturamento" value={formatCurrency(stats.faturamentoMes)} icon={DollarSign} color="green" onClick={() => navigate("/financeiro")} delay={300} />
            <KpiCard label="A Receber" value={formatCurrency(stats.aReceber)} icon={Wrench} color="red" onClick={() => navigate("/financeiro")} delay={400} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* OS Recentes - 2 columns */}
          <div className="lg:col-span-2">
            <PremiumCard delay={100}>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">OS Recentes</h2>

                <PremiumTable
                  columns={recentOSColumns}
                  data={recentOSData}
                  renderCell={renderOSCell}
                  onRowClick={(item) => setViewingOS(item.originalData)}
                  loading={loading}
                  emptyMessage="Nenhuma OS criada"
                  emptyIcon={<FileText className="h-8 w-8" />}
                  emptyAction={{
                    label: "Criar primeira OS",
                    onClick: () => navigate("/ordens-servico")
                  }}
                  animateRows={true}
                />
              </div>
            </PremiumCard>
          </div>

          {/* Alerts - 1 column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Alertas</h2>

            {overdueOS.length > 0 && (
              <AlertBox
                title={`${overdueOS.length} Ordens em Atraso`}
                items={overdueOS.slice(0, 3).map(os => ({
                  label: os.numero,
                  value: os.clientes?.nome || "N/A",
                }))}
                type="error"
                icon={AlertTriangle}
                onAction={() => navigate("/ordens-servico")}
                actionLabel="Ver Detalhes"
                delay={0}
              />
            )}

            {overduePayments.length > 0 && (
              <AlertBox
                title={`${overduePayments.length} Cobranças Vencidas`}
                items={[
                  {
                    label: "Total",
                    value: formatCurrency(overduePayments.reduce((a: number, p: any) => a + (p?.value || 0), 0)),
                  },
                ]}
                type="error"
                icon={DollarSign}
                onAction={() => navigate("/cobrancas")}
                actionLabel="Ver Cobranças"
                delay={100}
              />
            )}

            {stats.itensEstoqueBaixo > 0 && (
              <AlertBox
                title={`${stats.itensEstoqueBaixo} Itens com Estoque Baixo`}
                items={[
                  { label: "Itens", value: `${stats.itensEstoqueBaixo} abaixo do mínimo` },
                ]}
                type="warning"
                icon={Package}
                onAction={() => navigate("/estoque")}
                actionLabel="Ver Estoque"
                delay={200}
              />
            )}

            {overdueOS.length === 0 && overduePayments.length === 0 && stats.itensEstoqueBaixo === 0 && (
              <AlertBox
                title="Tudo em dia!"
                items={[]}
                type="success"
                icon={CheckCircle}
                delay={300}
              />
            )}
          </div>
        </div>

        {/* FAB mobile */}
        <button
          className="fixed bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+16px)] right-5 w-[52px] h-[52px] rounded-full bg-primary-600 text-white flex items-center justify-center z-[90] transition-all hover:bg-primary-700 hover:scale-105 lg:hidden"
          style={{ boxShadow: "0 4px 16px rgba(22,163,74,0.40)" }}
          onClick={() => navigate("/ordens-servico")}
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* View OS Dialog */}
        <Dialog open={!!viewingOS} onOpenChange={(open) => { if (!open) setViewingOS(null); }}>
          <DialogContent className="max-w-md max-h-[60vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base font-display">
                <span>OS {viewingOS?.numero}</span>
                {viewingOS && getStatusBadge(viewingOS.status)}
              </DialogTitle>
              <DialogDescription className="text-xs">Visualização rápida</DialogDescription>
            </DialogHeader>
            {viewingOS && (
              <>
                <div className="space-y-4 py-4 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Cliente</p><p className="text-sm font-medium">{viewingOS.clientes?.nome || "-"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Equipamento</p><p className="text-sm">{TIPO_EQUIPAMENTO[viewingOS.tipo_equipamento] || viewingOS.tipo_equipamento}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Modelo</p><p className="text-sm">{viewingOS.modelo_equipamento || "-"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Entrada</p><p className="text-sm">{formatDate(viewingOS.data_entrada)}</p></div>
                    <div className="col-span-2"><p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Defeito</p><p className="text-sm">{viewingOS.descricao_problema}</p></div>
                  </div>
                </div>
                <Separator />
                <DialogFooter className="sticky bottom-0 bg-background border-t pt-4">
                  <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" size="sm" onClick={() => { setViewingOS(null); navigate("/ordens-servico"); }}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />Ver Completa
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Index;