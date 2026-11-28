"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BadgeDollarSign, CheckCircle2, Download, Loader2, Receipt, Search, XCircle, FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, getErrorMessage } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { CommissionImpactTable } from "@/components/comissao/CommissionImpactTable";
import { getPeriodRange, fetchPayoutInvoiceItems, type PeriodRange } from "@/hooks/useTechnicianFinancials";
import { gerarFaturaSaquePDF } from "@/lib/payout-invoice-pdf";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { PeriodFilterBar } from "@/components/os/PeriodFilterBar";

interface FaturaAdmin {
  id: string;
  numero: string;
  status: string;
  technician_id: string;
  total: number;
  period_start: string | null;
  period_end: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  profiles?: { nome: string | null; telefone: string | null } | null;
}

const STATUS: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
  enviada: { label: "Enviada", className: "border-amber-500/30 bg-amber-500/15 text-amber-700" },
  paga: { label: "Paga", className: "border-blue-500/30 bg-blue-500/15 text-blue-700" },
  recusada: { label: "Recusada", className: "border-destructive/30 bg-destructive/15 text-destructive" },
  cancelada: { label: "Cancelada", className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground" },
};

export default function Comissoes() {
  const { config: empresa } = useEmpresaConfig();
  const [aba, setAba] = useState("faturas");
  const [period, setPeriod] = useState<PeriodRange>(() => getPeriodRange("mes"));
  const [faturas, setFaturas] = useState<FaturaAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todas");
  const [processando, setProcessando] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<FaturaAdmin | null>(null);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("technician_payout_invoices")
        .select("*, profiles!technician_payout_invoices_technician_id_fkey(nome, telefone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFaturas((data as unknown as FaturaAdmin[]) || []);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setFaturas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return faturas.filter((f) => {
      if (statusFiltro !== "todas" && f.status !== statusFiltro) return false;
      if (!termo) return true;
      return (
        f.numero.toLowerCase().includes(termo) ||
        (f.profiles?.nome || "").toLowerCase().includes(termo)
      );
    });
  }, [faturas, busca, statusFiltro]);

  const totais = useMemo(
    () =>
      visiveis.reduce(
        (acc, f) => ({
          total: acc.total + Number(f.total || 0),
          pagas: acc.pagas + (f.status === "paga" ? Number(f.total || 0) : 0),
          abertas: acc.abertas + (f.status === "enviada" || f.status === "rascunho" ? Number(f.total || 0) : 0),
        }),
        { total: 0, pagas: 0, abertas: 0 },
      ),
    [visiveis],
  );

  const liquidar = async (fatura: FaturaAdmin, pago: boolean, razao?: string) => {
    setProcessando(fatura.id);
    try {
      const { error } = await supabase.rpc("settle_technician_payout_invoice", {
        _invoice_id: fatura.id,
        _paid: pago,
        _reason: razao ?? null,
      });
      if (error) throw error;
      toast.success(pago ? `Fatura ${fatura.numero} marcada como paga.` : `Fatura ${fatura.numero} recusada.`);
      setRecusando(null);
      setMotivo("");
      await carregar();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setProcessando(null);
    }
  };

  const baixarPdf = async (fatura: FaturaAdmin) => {
    try {
      const itens = await fetchPayoutInvoiceItems(fatura.id);
      const doc = await gerarFaturaSaquePDF({
        invoice: {
          numero: fatura.numero, status: fatura.status, total: Number(fatura.total) || 0,
          period_start: fatura.period_start, period_end: fatura.period_end,
          pix_key: fatura.pix_key, pix_key_type: fatura.pix_key_type, notes: fatura.notes,
          sent_at: fatura.sent_at, paid_at: fatura.paid_at, rejected_reason: fatura.rejected_reason,
        },
        items: itens.map((i) => ({
          description: i.description, reference_date: i.reference_date,
          amount: Number(i.amount) || 0, kind: i.kind, snapshot: i.snapshot as Record<string, unknown>,
        })),
        empresa: {
          nome: empresa.nome_empresa, cnpj: empresa.cnpj, telefone: empresa.telefone,
          endereco: empresa.endereco, logo_url: empresa.logo_url,
        },
        tecnico: { nome: fatura.profiles?.nome || "Técnico", telefone: fatura.profiles?.telefone },
      });
      doc.save(`fatura-saque-${fatura.numero}.pdf`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <BadgeDollarSign className="h-8 w-8 text-primary" />
            Comissões
          </h1>
          <p className="text-muted-foreground">
            Faturas de saque dos técnicos e conferência da regra de comissão
          </p>
        </div>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="faturas" className="gap-1.5">
              <Receipt className="h-4 w-4" /> Faturas de saque
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Conferência da comissão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="faturas" className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Resumo rotulo="Total listado" valor={totais.total} />
              <Resumo rotulo="Já pago" valor={totais.pagas} cor="text-blue-600" />
              <Resumo rotulo="Em aberto" valor={totais.abertas} cor="text-amber-600" />
            </div>

            <PremiumCard delay={0} rotulo="Faturas por técnico">
              <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Faturas por técnico</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Número ou técnico"
                      className="h-9 w-full pl-8 sm:w-52"
                    />
                  </div>
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger className="h-9 sm:w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todos os status</SelectItem>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : visiveis.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma fatura de saque encontrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visiveis.map((f) => {
                      const st = STATUS[f.status] ?? STATUS.rascunho;
                      const liquidavel = f.status === "rascunho" || f.status === "enviada";
                      return (
                        <div
                          key={f.id}
                          className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-semibold">#{f.numero}</span>
                              <Badge variant="outline" className={cn("text-[10px]", st.className)}>{st.label}</Badge>
                              <span className="text-sm font-medium">{f.profiles?.nome || "Técnico"}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {f.period_start && f.period_end
                                ? `${formatDate(f.period_start)} a ${formatDate(f.period_end)}`
                                : `Criada em ${formatDate(f.created_at)}`}
                              {f.pix_key ? ` · PIX ${f.pix_key_type || "chave"}: ${f.pix_key}` : ""}
                              {f.paid_at ? ` · paga em ${formatDate(f.paid_at)}` : ""}
                              {f.rejected_reason ? ` · recusada: ${f.rejected_reason}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-semibold text-primary">
                              {formatCurrency(Number(f.total) || 0)}
                            </span>
                            <Button variant="outline" size="icon" className="h-8 w-8" title="Baixar PDF" onClick={() => baixarPdf(f)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {liquidavel && (
                              <>
                                <Button
                                  size="sm"
                                  className="gradient-primary"
                                  disabled={processando === f.id}
                                  onClick={() => liquidar(f, true)}
                                >
                                  {processando === f.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                                  Marcar como paga
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive"
                                  disabled={processando === f.id}
                                  onClick={() => { setRecusando(f); setMotivo(""); }}
                                >
                                  <XCircle className="mr-1.5 h-4 w-4" /> Recusar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </PremiumCard>
          </TabsContent>

          <TabsContent value="conferencia" className="space-y-4 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Compara o valor gravado em cada OS com o que a regra nova apura. Nada é corrigido em silêncio:
                as OS já pagas geram lançamento de ajuste.
              </p>
              <PeriodFilterBar period={period} onChange={setPeriod} />
            </div>
            <CommissionImpactTable period={period} />
          </TabsContent>
        </Tabs>

        <Dialog open={!!recusando} onOpenChange={(v) => !v && setRecusando(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Recusar fatura {recusando?.numero}</DialogTitle>
              <DialogDescription>
                Informe o motivo. O técnico recebe uma notificação com o texto abaixo e as OS voltam a ficar
                disponíveis para uma nova fatura.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: valores divergentes da OS 031." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRecusando(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={!motivo.trim() || processando === recusando?.id}
                onClick={() => recusando && liquidar(recusando, false, motivo.trim())}
              >
                {processando === recusando?.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <XCircle className="mr-1.5 h-4 w-4" />}
                Recusar fatura
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function Resumo({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={cn("mt-1.5 font-mono text-xl font-semibold tabular-nums", cor)}>{formatCurrency(valor)}</p>
    </div>
  );
}
