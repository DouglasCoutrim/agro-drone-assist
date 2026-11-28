import { useEffect, useState, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PainelOrdenavel } from "@/components/layout/PainelOrdenavel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Coins, CheckCircle2, ListChecks, Clock, AlertTriangle, TrendingUp, Calculator, ChevronDown, ArrowRightLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency, getErrorMessage, todayDateInput } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { osEmAtraso } from "@/lib/os-prazo";
import { LOCK_CLOSED_STATUSES, aplicarStatusOs } from "@/lib/os-status-update";
import { TechnicianAnalytics } from "@/components/os/TechnicianAnalytics";
import { OSSummaryDialog } from "@/components/os/OSSummaryDialog";
import { getPeriodRange } from "@/hooks/useTechnicianFinancials";

interface OSKanban {
  id: string;
  numero: string;
  cliente: string | null;
  equipamento: string | null;
  tipo_equipamento?: string;
  prioridade: string;
  status: string;
  tempo_em_bancada_min: number;
  data_entrada: string | null;
  data_previsao: string | null;
  prazo_diagnostico_horas: number | null;
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

// Quantidade de itens mostrados antes de o cartão ser expandido.
const LIMITE_PREVIA = 3;

// Coluna do painel -> status real gravado em `ordens_servico.status`. Os agrupamentos são os
// mesmos usados pela RPC `get_technician_dashboard` (via `os_status_grupo`).
const STATUS_POR_COLUNA: Record<string, string> = {
  aguardando_avaliacao: "aguardando_diagnostico",
  em_analise: "aguardando_aprovacao",
  aguardando_peca: "aguardando_peca",
  em_execucao: "em_reparo",
  concluido: "concluida",
};

/** Em qual coluna a OS aparece hoje, a partir do status real dela. */
const colunaDoStatus = (status: string): string => {
  if (LOCK_CLOSED_STATUSES.has(status)) return "concluido";
  if (["recebido", "aberta", "aguardando_diagnostico"].includes(status)) return "aguardando_avaliacao";
  if (["aguardando_aprovacao", "aprovado"].includes(status)) return "em_analise";
  if (status === "aguardando_peca") return "aguardando_peca";
  return "em_execucao";
};

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
  const { user, roles, canEdit } = useAuth();
  const { permissions, blocked } = usePermissions();
  const { organization, isPlatformAdmin } = useOrganization();
  const podeFinalizarOs = permissions?.pode_finalizar_os === true;
  // Arrastar só faz sentido para quem consegue gravar: edição da OS ou permissão de fechar.
  const podeMoverOs = canEdit || podeFinalizarOs;
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [verTodasAtrasadas, setVerTodasAtrasadas] = useState(false);
  const [verTodasComissoes, setVerTodasComissoes] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);

  // `silent` recarrega os dados sem trocar a tela pelo spinner (usado ao mover um cartão).
  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      // Sobrecarga explícita de 3 argumentos (a de 1 argumento foi removida).
      const mes = getPeriodRange("mes");
      const { data: res } = await supabase.rpc("get_technician_dashboard" as any, {
        _tecnico_id: user.id,
        _period_start: todayDateInput(mes.start),
        _period_end: todayDateInput(mes.end),
      });
      setData(res as DashboardPayload | null);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const next = data?.next_os;

  const FINAL_STATUSES = new Set(["concluido", "entregue", "cancelada"]);

  const allOs = useMemo(() => {
    const list: OSKanban[] = [];
    if (!data?.kanban) return list;
    Object.values(data.kanban).forEach(osList => osList.forEach(os => list.push(os)));
    return list;
  }, [data]);

  // Atraso segue a fase da OS: prazo de diagnóstico, pausa na aprovação do cliente
  // e previsão de entrega depois do aceite (ver src/lib/os-prazo.ts).
  const overdueOs = useMemo(() => allOs.filter((os) => osEmAtraso(os)), [allOs]);

  const pendingCommissionOs = useMemo(() => {
    return allOs.filter(os => !FINAL_STATUSES.has(os.status));
  }, [allOs]);

  const totalPendingCommission = pendingCommissionOs.reduce((s, os) => s + (os.commission_total || 0), 0);
  const totalOverdueKm = overdueOs.reduce((s, os) => s + (os.tempo_em_bancada_min || 0), 0);

  const atrasadasVisiveis = verTodasAtrasadas ? overdueOs : overdueOs.slice(0, LIMITE_PREVIA);
  const comissoesVisiveis = verTodasComissoes ? pendingCommissionOs : pendingCommissionOs.slice(0, LIMITE_PREVIA);

  /**
   * Move a OS para a coluna escolhida aplicando o status correspondente. As validações de
   * permissão, checklist obrigatório, datas, comissão e histórico ficam em
   * `@/lib/os-status-update` — as mesmas usadas pela tela de Ordens de Serviço.
   */
  const moverOs = async (os: OSKanban, destino: string) => {
    const novoStatus = STATUS_POR_COLUNA[destino];
    if (!novoStatus || colunaDoStatus(os.status) === destino) return;
    setMovendo(os.id);
    try {
      await aplicarStatusOs({
        osId: os.id,
        novoStatus,
        organizationId: organization?.id,
        isPlatformAdmin,
        userId: user?.id,
        podeEditar: canEdit,
        podeFinalizarOs,
      });
      const label = KANBAN_COLUMNS.find(c => c.key === destino)?.label || destino;
      toast.success(`OS ${os.numero} movida para "${label}"`);
      // Recarrega sem esconder o quadro atrás do spinner.
      await load(true);
    } catch (e) {
      console.error("Erro ao mover OS no painel do técnico:", e);
      toast.error(getErrorMessage(e));
    } finally {
      setMovendo(null);
    }
  };

  const soltarNaColuna = async (destino: string) => {
    const osId = arrastando;
    setArrastando(null);
    setColunaAlvo(null);
    if (!osId) return;
    const os = allOs.find(o => o.id === osId);
    if (os) await moverOs(os, destino);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold">Meu Painel</h1>
            <p className="text-sm text-muted-foreground">Acompanhe suas ordens de serviço e comissões</p>
          </div>
          {/* O item "Meu Financeiro" saiu do menu lateral; o técnico chega ao
              financeiro por aqui. Mesmas regras de antes: só o perfil tecnico e
              respeitando o bloqueio por usuário definido na tela Equipe. */}
          {roles.includes("tecnico") && !blocked.includes("/technician/financeiro") && (
            <Button asChild variant="outline" className="gap-2">
              <Link to="/technician/financeiro">
                <Calculator className="h-4 w-4" />
                Meu financeiro
              </Link>
            </Button>
          )}
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <PainelOrdenavel tela="tecnico">
            {/* Fila prioritária */}
            <div data-bloco="fila" data-rotulo="Próxima OS da fila" className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-5 flex items-center gap-4 flex-wrap">
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
            <div data-bloco="resumo" data-rotulo="Resumo financeiro" className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <KpiCard label="Sua Comissão no Mês" value={formatCurrency(data.realized_month ?? 0)} icon={Coins} color="bg-green-500/15 text-green-600" sub="Já líquida de imposto e custo do serviço" />
              <KpiCard label="Comissões Estimadas (Mês)" value={formatCurrency(data.estimated_month ?? 0)} icon={Clock} color="bg-blue-500/15 text-blue-600" sub="OS em andamento/aprovação" />
              <KpiCard label="Serviços Concluídos (Mês)" value={data.services_done_month ?? 0} icon={CheckCircle2} color="bg-violet-500/15 text-violet-600" />
            </div>

            {/* OS Atrasadas e Comissões a Receber */}
            <div data-bloco="pendencias" data-rotulo="OS atrasadas e comissões a receber" className="grid gap-3 md:grid-cols-2">
              <Card className={`shadow-soft ${overdueOs.length > 0 ? "border-destructive/30" : "border-border"}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${overdueOs.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                    OS Atrasadas
                    {overdueOs.length > 0 && <Badge variant="destructive" className="ml-auto">{overdueOs.length}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {overdueOs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma OS atrasada! ✅</p>
                  ) : (
                    <>
                      {atrasadasVisiveis.map(os => (
                        <div key={os.id} className="flex items-center justify-between p-2 bg-destructive/5 border border-destructive/10 rounded-lg">
                          <div>
                            <p className="text-xs font-mono font-semibold">{os.numero}</p>
                            <p className="text-xs text-muted-foreground">{os.cliente || "—"} • {formatBenchTime(os.tempo_em_bancada_min)} em bancada</p>
                          </div>
                          <Badge variant="destructive">Atrasada</Badge>
                        </div>
                      ))}
                      {overdueOs.length > LIMITE_PREVIA && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full gap-1 text-xs"
                          aria-expanded={verTodasAtrasadas}
                          onClick={() => setVerTodasAtrasadas(v => !v)}
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform", verTodasAtrasadas && "rotate-180")} />
                          {verTodasAtrasadas ? "Ver menos" : `Ver todas as ${overdueOs.length}`}
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    Comissões a Receber
                    <Badge className="ml-auto bg-success/15 text-success border-success/30">{formatCurrency(totalPendingCommission)}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingCommissionOs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma comissão pendente.</p>
                  ) : (
                    <div className="space-y-2">
                      {comissoesVisiveis.map(os => (
                        <div key={os.id} className="flex items-center justify-between p-2 bg-card border border-border rounded-lg">
                          <div>
                            <p className="text-xs font-mono font-semibold">{os.numero}</p>
                            <p className="text-xs text-muted-foreground">{os.cliente || "—"} • {os.status.replace("_", " ")}</p>
                          </div>
                          <span className="text-sm font-bold text-success">{os.commission_total ? formatCurrency(os.commission_total) : "—"}</span>
                        </div>
                      ))}
                      {pendingCommissionOs.length > LIMITE_PREVIA && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full gap-1 text-xs"
                          aria-expanded={verTodasComissoes}
                          onClick={() => setVerTodasComissoes(v => !v)}
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform", verTodasComissoes && "rotate-180")} />
                          {verTodasComissoes ? "Ver menos" : `Ver todas as ${pendingCommissionOs.length}`}
                        </Button>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between font-bold text-sm">
                        <span>Total a receber:</span>
                        <span className="text-success">{formatCurrency(totalPendingCommission)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            </PainelOrdenavel>

            {/* Kanban — arraste o cartão para outra coluna para mudar o status da OS */}
            <div className="grid gap-4 lg:grid-cols-5">
              {KANBAN_COLUMNS.map(col => {
                const list = data.kanban?.[col.key] || [];
                const destacada = colunaAlvo === col.key && arrastando !== null;
                // Quem só tem a permissão de fechar só pode soltar na coluna "Concluído".
                const aceita = canEdit || LOCK_CLOSED_STATUSES.has(STATUS_POR_COLUNA[col.key]);
                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => {
                      if (!arrastando) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = aceita ? "move" : "none";
                      setColunaAlvo(atual => (atual === col.key ? atual : col.key));
                    }}
                    onDragLeave={() => setColunaAlvo(atual => (atual === col.key ? null : atual))}
                    onDrop={(e) => { e.preventDefault(); void soltarNaColuna(col.key); }}
                    className={cn(
                      "rounded-2xl border border-border bg-muted/30 flex flex-col transition-colors",
                      destacada && aceita && "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
                      destacada && !aceita && "border-destructive/50 bg-destructive/5",
                    )}
                  >
                    <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
                      <p className="text-xs font-semibold uppercase tracking-wide">{col.label}</p>
                      <span className="text-xs bg-background border border-border rounded-full px-2 py-0.5">{list.length}</span>
                    </div>
                    <div className="p-2 space-y-2 overflow-y-auto max-h-[420px]">
                      {list.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">Sem OS</p>
                      )}
                      {list.map(os => (
                        <div
                          key={os.id}
                          draggable={podeMoverOs}
                          onDragStart={(e) => {
                            setArrastando(os.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", os.id);
                          }}
                          onDragEnd={() => { setArrastando(null); setColunaAlvo(null); }}
                          onClick={() => setOpenId(os.id)}
                          className={cn(
                            "bg-card border border-border rounded-xl p-3 space-y-1.5 shadow-sm cursor-pointer hover:bg-accent/50",
                            podeMoverOs && "active:cursor-grabbing",
                            arrastando === os.id && "opacity-40",
                            movendo === os.id && "opacity-60 pointer-events-none",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold">{os.numero}</span>
                            <Badge variant={prioridadeVariant(os.prioridade)} className="capitalize">{os.prioridade}</Badge>
                          </div>
                          <p className="text-sm font-medium truncate">{os.cliente || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{os.equipamento || "—"}</p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatBenchTime(os.tempo_em_bancada_min)} em bancada</span>
                            <div className="flex items-center gap-1">
                              {os.commission_total ? <span className="text-green-600 font-medium">{formatCurrency(os.commission_total)}</span> : null}
                              {/* Alternativa ao arrastar: funciona no toque (celular) e no teclado. */}
                              {podeMoverOs && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={`Mover OS ${os.numero} para outra coluna`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    >
                                      <ArrowRightLeft className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                                    {KANBAN_COLUMNS.filter(c => c.key !== col.key).map(c => (
                                      <DropdownMenuItem
                                        key={c.key}
                                        disabled={movendo === os.id || (!canEdit && !LOCK_CLOSED_STATUSES.has(STATUS_POR_COLUNA[c.key]))}
                                        onSelect={() => void moverOs(os, c.key)}
                                      >
                                        {c.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
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
        {user && <TechnicianAnalytics userId={user.id} />}
        <OSSummaryDialog osId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
      </div>
    </MainLayout>
  );
}