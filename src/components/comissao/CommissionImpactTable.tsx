"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PremiumCard } from "@/components/premium/PremiumCard";
import { toast } from "sonner";
import { AlertTriangle, Calculator, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, getErrorMessage, todayDateInput } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { PeriodRange } from "@/hooks/useTechnicianFinancials";

export interface ImpactoComissaoRow {
  os_id: string;
  numero: string;
  tecnico_id: string | null;
  tecnico: string | null;
  data: string;
  valor_os: number;
  comissao_antiga: number;
  comissao_nova: number;
  diferenca: number;
  paga: boolean;
  fatura_numero: string | null;
  fatura_status: string | null;
}

/**
 * Conferência da comissão: compara o valor gravado na OS com o que a regra nova apura,
 * mostra a diferença por OS e permite recalcular em lote. As OS já pagas viram lançamento
 * de ajuste no extrato do técnico, em vez de serem corrigidas em silêncio.
 */
export function CommissionImpactTable({ period }: { period: PeriodRange }) {
  const [rows, setRows] = useState<ImpactoComissaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [somenteNaoPagas, setSomenteNaoPagas] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("relatorio_impacto_comissao", {
        _period_start: todayDateInput(period.start),
        _period_end: todayDateInput(period.end),
      });
      if (error) throw error;
      setRows(Array.isArray(data) ? (data as unknown as ImpactoComissaoRow[]) : []);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [period.start, period.end]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totais = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        antiga: acc.antiga + Number(r.comissao_antiga || 0),
        nova: acc.nova + Number(r.comissao_nova || 0),
        diferenca: acc.diferenca + Number(r.diferenca || 0),
        divergentes: acc.divergentes + (Math.abs(Number(r.diferenca || 0)) >= 0.01 ? 1 : 0),
      }),
      { antiga: 0, nova: 0, diferenca: 0, divergentes: 0 },
    );
  }, [rows]);

  const recalcular = async () => {
    setRecalculando(true);
    try {
      const { data, error } = await supabase.rpc("recalcular_comissoes_em_lote", {
        _somente_nao_pagas: somenteNaoPagas,
      });
      if (error) throw error;
      const r = (data || {}) as { atualizadas?: number; ajustes?: number; total_ajustes?: number };
      toast.success(
        `${r.atualizadas ?? 0} OS recalculada(s). ${r.ajustes ?? 0} ajuste(s) lançado(s)` +
          (r.total_ajustes ? ` (${formatCurrency(Number(r.total_ajustes))}).` : "."),
      );
      await carregar();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setRecalculando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <ResumoCard rotulo="Comissão gravada" valor={totais.antiga} />
        <ResumoCard rotulo="Comissão pela regra nova" valor={totais.nova} />
        <ResumoCard
          rotulo="Diferença a acertar"
          valor={totais.diferenca}
          destaque={Math.abs(totais.diferenca) >= 0.01}
          negativo={totais.diferenca < 0}
        />
      </div>

      <PremiumCard delay={0} rotulo="Conferência da comissão">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Calculator className="h-4 w-4 text-primary" /> Conferência da comissão
            </h3>
            <p className="text-xs text-muted-foreground">
              {rows.length} OS no período · {totais.divergentes} com divergência
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={somenteNaoPagas} onCheckedChange={(v) => setSomenteNaoPagas(!!v)} />
              Só OS sem fatura paga
            </label>
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Atualizar
            </Button>
            <Button size="sm" className="gradient-primary" onClick={recalcular} disabled={recalculando || rows.length === 0}>
              {recalculando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Calculator className="mr-1.5 h-4 w-4" />}
              Recalcular em lote
            </Button>
          </div>
        </div>

        {!somenteNaoPagas && (
          <div className="flex items-start gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              As OS já pagas não são alteradas: a diferença entra como lançamento de ajuste no extrato do técnico.
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma OS concluída no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">OS</th>
                  <th className="px-3 py-2.5">Técnico</th>
                  <th className="px-3 py-2.5">Data</th>
                  <th className="px-3 py-2.5 text-right">Valor da OS</th>
                  <th className="px-3 py-2.5 text-right">Comissão antiga</th>
                  <th className="px-3 py-2.5 text-right">Comissão nova</th>
                  <th className="px-3 py-2.5 text-right">Diferença</th>
                  <th className="px-3 py-2.5">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.map((r) => {
                  const dif = Number(r.diferenca || 0);
                  return (
                    <tr key={r.os_id} className="hover:bg-accent/40">
                      <td className="px-3 py-2.5 font-mono">#{r.numero}</td>
                      <td className="px-3 py-2.5">{r.tecnico || "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(r.data)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {formatCurrency(Number(r.valor_os || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                        {formatCurrency(Number(r.comissao_antiga || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {formatCurrency(Number(r.comissao_nova || 0))}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right font-mono tabular-nums font-semibold",
                          Math.abs(dif) < 0.01 ? "text-muted-foreground" : dif > 0 ? "text-emerald-600" : "text-destructive",
                        )}
                      >
                        <span className="inline-flex items-center gap-1">
                          {Math.abs(dif) >= 0.01 &&
                            (dif > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />)}
                          {formatCurrency(dif)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.paga ? (
                          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/15 text-[10px] text-blue-700">
                            Paga
                          </Badge>
                        ) : r.fatura_numero ? (
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-700">
                            #{r.fatura_numero} ({r.fatura_status})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Em aberto</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>
    </div>
  );
}

function ResumoCard({
  rotulo, valor, destaque, negativo,
}: { rotulo: string; valor: number; destaque?: boolean; negativo?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-soft",
        destaque && (negativo ? "border-destructive/40" : "border-emerald-500/40"),
      )}
    >
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tabular-nums",
          destaque && (negativo ? "text-destructive" : "text-emerald-600"),
        )}
      >
        {formatCurrency(valor)}
      </p>
    </div>
  );
}
