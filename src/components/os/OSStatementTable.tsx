"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FileText, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { OSSummaryDialog } from "./OSSummaryDialog";
import type { OSStatementItem, SituacaoComissao } from "@/hooks/useTechnicianFinancials";

interface OSStatementTableProps {
  data: OSStatementItem[];
  loading?: boolean;
  /** Recebe as OS selecionadas prontas para virar fatura de saque. */
  onGenerateInvoice?: (osIds: string[]) => void;
}

const SITUACAO: Record<SituacaoComissao, { label: string; className: string }> = {
  A_RECEBER: { label: "A receber", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  AGUARDANDO_CLIENTE: { label: "Aguardando cliente", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  RECEBIDO: { label: "Recebido", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  DIVERGENCIA: { label: "Divergência", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

/** Só entra em fatura o que o cliente já pagou e ainda não foi faturado. */
const podeFaturar = (item: OSStatementItem) =>
  item.situacao === "A_RECEBER" && !item.fatura_id && Number(item.comissao) > 0;

export function OSStatementTable({ data, loading = false, onGenerateInvoice }: OSStatementTableProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const elegiveis = useMemo(() => data.filter(podeFaturar), [data]);
  const totalSelecionado = useMemo(
    () => data.filter((i) => selected.has(i.os_id)).reduce((soma, i) => soma + Number(i.comissao || 0), 0),
    [data, selected],
  );

  const toggle = (id: string) =>
    setSelected((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const toggleTodos = () =>
    setSelected((atual) =>
      atual.size === elegiveis.length ? new Set() : new Set(elegiveis.map((i) => i.os_id)),
    );

  const total = data.reduce(
    (acc, item) => ({
      valor_os: acc.valor_os + Number(item.valor_os || 0),
      imposto: acc.imposto + Number(item.imposto || 0),
      custo: acc.custo + Number(item.custo || 0),
      comissao: acc.comissao + Number(item.comissao || 0),
    }),
    { valor_os: 0, imposto: 0, custo: 0, comissao: 0 },
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground">Extrato de Serviços</h3>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse grid grid-cols-6 gap-4 items-center">
              {[...Array(6)].map((__, j) => (
                <div key={j} className="h-4 bg-muted rounded w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground">Extrato de Serviços</h3>
        </div>
        <div className="p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma OS concluída neste período</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Extrato de Serviços</h3>
        <span className="text-xs text-muted-foreground">{data.length} OS(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <th className="px-3 py-2.5 w-[40px]">
                <Checkbox
                  checked={elegiveis.length > 0 && selected.size === elegiveis.length}
                  onCheckedChange={toggleTodos}
                  disabled={elegiveis.length === 0}
                  aria-label="Selecionar todas as OS a receber"
                />
              </th>
              <th className="px-3 py-2.5 w-[110px]">OS</th>
              <th className="px-3 py-2.5 w-[95px]">Data</th>
              <th className="px-3 py-2.5 text-right w-[105px]">Valor da OS</th>
              <th className="px-3 py-2.5 text-right w-[90px]">Imposto</th>
              <th className="px-3 py-2.5 text-right w-[90px]">Custo</th>
              <th className="px-3 py-2.5 text-right w-[95px]">Saldo</th>
              <th className="px-3 py-2.5 text-right w-[110px]">Sua comissão</th>
              <th className="px-3 py-2.5 w-[160px]">Situação</th>
              <th className="px-3 py-2.5 w-[150px]">Fatura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {data.map((item) => {
              const saldo = Number(item.commission_base || 0) - Number(item.imposto || 0) - Number(item.custo || 0);
              const situacao = SITUACAO[item.situacao] ?? SITUACAO.AGUARDANDO_CLIENTE;
              return (
                <tr key={item.os_id} className="hover:bg-accent/40 transition-colors">
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected.has(item.os_id)}
                      onCheckedChange={() => toggle(item.os_id)}
                      disabled={!podeFaturar(item)}
                      aria-label={`Selecionar OS ${item.os_numero}`}
                    />
                  </td>
                  <td
                    className="px-3 py-2.5 font-mono text-foreground cursor-pointer"
                    onClick={() => setOpenId(item.os_id)}
                  >
                    #{item.os_numero}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(item.data_conclusao)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-foreground">{formatCurrency(Number(item.valor_os || 0))}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(Number(item.imposto || 0))}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(Number(item.custo || 0))}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(saldo)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-primary">{formatCurrency(Number(item.comissao || 0))}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={cn("text-[10px]", situacao.className)}>{situacao.label}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {item.fatura_numero ? `#${item.fatura_numero} (${item.fatura_status})` : "—"}
                  </td>
                </tr>
              );
            })}

            <tr className="bg-muted/50 font-semibold border-t-2 border-border">
              <td className="px-3 py-2.5" colSpan={3}>TOTAL</td>
              <td className="px-3 py-2.5 text-right text-foreground">{formatCurrency(total.valor_os)}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{formatCurrency(total.imposto)}</td>
              <td className="px-3 py-2.5 text-right text-foreground">{formatCurrency(total.custo)}</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right text-primary">{formatCurrency(total.comissao)}</td>
              <td className="px-3 py-2.5" colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border/50 bg-muted/20 px-4 py-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Selecionado: </span>
          <span className="font-semibold text-primary">{formatCurrency(totalSelecionado)}</span>
          <span className="text-xs text-muted-foreground"> ({selected.size} OS)</span>
        </p>
        <Button
          size="sm"
          className="gradient-primary"
          disabled={selected.size === 0 || !onGenerateInvoice}
          onClick={() => onGenerateInvoice?.(Array.from(selected))}
        >
          <Receipt className="mr-1.5 h-4 w-4" /> Gerar fatura de saque
        </Button>
      </div>

      <OSSummaryDialog osId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
