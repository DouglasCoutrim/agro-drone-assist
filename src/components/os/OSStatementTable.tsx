"use client";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { Shield, FileText, BadgePercent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OSStatementItem } from "@/hooks/useTechnicianFinancials";

interface OSStatementTableProps {
  data: OSStatementItem[];
  loading?: boolean;
}

export function OSStatementTable({ data, loading = false }: OSStatementTableProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground">Extrato de Serviços</h3>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse grid grid-cols-[1fr_80px_80px_80px_80px_100px] gap-4 items-center text-sm">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
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

  // Totais
  const totals = data.reduce(
    (acc, item) => ({
      valor_bruto: acc.valor_bruto + item.valor_bruto,
      imposto_descontado: acc.imposto_descontado + item.imposto_descontado,
      comissao_liquida: acc.comissao_liquida + item.comissao_liquida,
    }),
    { valor_bruto: 0, imposto_descontado: 0, comissao_liquida: 0 }
  );

  const getRoleBadge = (role: "PRINCIPAL" | "AUXILIARY") => (
    <Badge variant={role === "PRINCIPAL" ? "default" : "secondary"} className="gap-1">
      {role === "PRINCIPAL" ? <BadgePercent className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      {role === "PRINCIPAL" ? "Principal" : "Auxiliar"}
    </Badge>
  );

  const getNFeBadge = (emitida: boolean) => (
    <Badge variant={emitida ? "default" : "outline"} className="gap-1 h-5 px-2">
      <Shield className={cn("h-3 w-3", emitida ? "text-blue-500" : "text-amber-500")} />
      {emitida ? "NFe emitida" : "Sem NFe"}
    </Badge>
  );

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Extrato de Serviços</h3>
        <span className="text-xs text-muted-foreground">{data.length} OS(s)</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-2.5 w-[120px]">Nº OS</th>
              <th className="px-4 py-2.5 w-[100px]">Papel</th>
              <th className="px-4 py-2.5 w-[100px]">Data</th>
              <th className="px-4 py-2.5 text-right w-[110px]">Valor Bruto</th>
              <th className="px-4 py-2.5 text-right w-[110px]">Imposto</th>
              <th className="px-4 py-2.5 text-right w-[110px]">Líquido</th>
              <th className="px-4 py-2.5 w-[100px]">NFe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {data.map((item) => (
              <tr key={item.os_id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-foreground">
                  #{item.os_numero}
                </td>
                <td className="px-4 py-2.5">{getRoleBadge(item.role)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {formatDate(item.data_conclusao)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-foreground">
                  {formatCurrency(item.valor_bruto)}
                </td>
                <td className="px-4 py-2.5 text-right text-orange-500 font-medium">
                  -{formatCurrency(item.imposto_descontado)}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                  {formatCurrency(item.comissao_liquida)}
                </td>
                <td className="px-4 py-2.5">{getNFeBadge(item.nfe_emitida)}</td>
              </tr>
            ))}
            
            {/* Linha de totais */}
            <tr className="bg-muted/50 font-semibold border-t-2 border-border">
              <td className="px-4 py-2.5" colSpan={3}>TOTAL</td>
              <td className="px-4 py-2.5 text-right text-foreground">{formatCurrency(totals.valor_bruto)}</td>
              <td className="px-4 py-2.5 text-right text-orange-500">-{formatCurrency(totals.imposto_descontado)}</td>
              <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(totals.comissao_liquida)}</td>
              <td className="px-4 py-2.5"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}