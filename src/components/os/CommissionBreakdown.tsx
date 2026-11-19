import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { TAXA_SEM_NOTA_PADRAO } from "@/lib/commission";
import { AlertTriangle, Lock, Shield } from "lucide-react";

export interface CommissionBreakdownData {
  /** Valor efetivamente cobrado da OS (valor_final ou itens - desconto). */
  valorOs?: number | null;
  base: number;
  imposto: number;
  custo: number;
  saldo: number;
  loja: number;
  taxaSemNota: number;
  comissao: number;
  aliquota: number;
  nfeEmitida: boolean;
  /** Taxa sem nota configurada (%), usada só para rotular a linha. */
  taxaPercentual?: number;
  congeladoEm?: string | null;
  semTecnico?: boolean;
  /** OS alterada depois do congelamento, ou concluída sem custo lançado. */
  avisos?: string[];
}

/** Lê o rateio gravado na OS (`ordens_servico.commission_*`). */
export function rateioDaOS(os: Record<string, unknown> | null | undefined, valorOs?: number | null): CommissionBreakdownData {
  const numero = (chave: string) => Number((os as Record<string, unknown> | null)?.[chave]) || 0;
  return {
    valorOs: valorOs ?? null,
    base: numero("commission_base"),
    imposto: numero("commission_tax"),
    custo: numero("commission_cost"),
    saldo: numero("commission_base") - numero("commission_tax") - numero("commission_cost"),
    loja: numero("commission_company"),
    taxaSemNota: numero("commission_no_note_fee"),
    comissao: numero("commission_total"),
    aliquota: numero("commission_tax_rate"),
    taxaPercentual: TAXA_SEM_NOTA_PADRAO,
    nfeEmitida: Boolean((os as Record<string, unknown> | null)?.nfe_emitida),
    congeladoEm: ((os as Record<string, unknown> | null)?.commission_frozen_at as string | null) ?? null,
    semTecnico: !(os as Record<string, unknown> | null)?.tecnico_id,
  };
}

function Linha({
  rotulo,
  valor,
  sinal,
  destaque,
  sufixo,
}: {
  rotulo: string;
  valor: number;
  sinal?: string;
  destaque?: boolean;
  sufixo?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", destaque && "font-semibold")}>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {sinal && <span className="font-mono text-xs w-3">{sinal}</span>}
        <span className={cn(destaque && "text-foreground")}>{rotulo}</span>
        {sufixo}
      </span>
      <span className={cn("font-mono tabular-nums", destaque ? "text-primary" : "text-foreground")}>
        {formatCurrency(valor)}
      </span>
    </div>
  );
}

export function CommissionBreakdown({ data, className }: { data: CommissionBreakdownData; className?: string }) {
  if (data.semTecnico) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground", className)}>
        OS sem técnico responsável — não há comissão a dividir.
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rateio do serviço</p>
        {data.nfeEmitida ? (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600">
            <Shield className="h-3 w-3" /> Nota emitida
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
            <AlertTriangle className="h-3 w-3" /> Sem nota
          </Badge>
        )}
      </div>

      {data.valorOs != null && <Linha rotulo="Valor cobrado da OS" valor={data.valorOs} />}
      <Linha
        rotulo="Imposto da nota"
        valor={data.imposto}
        sinal="−"
        sufixo={data.nfeEmitida && data.aliquota > 0 ? <span className="text-xs">({data.aliquota}%)</span> : null}
      />
      <Linha rotulo="Custo do serviço" valor={data.custo} sinal="−" />
      <Linha rotulo="Saldo a dividir" valor={data.saldo} sinal="=" destaque />
      <div className="pl-4 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>Loja (50%)</span>
          <span className="font-mono tabular-nums">{formatCurrency(data.loja)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Você (50%)</span>
          <span className="font-mono tabular-nums">{formatCurrency(data.saldo - data.loja)}</span>
        </div>
      </div>
      <Linha
        rotulo="Taxa sem nota"
        valor={data.taxaSemNota}
        sinal="−"
        sufixo={
          !data.nfeEmitida ? (
            <span className="text-xs">({(data.taxaPercentual ?? TAXA_SEM_NOTA_PADRAO).toLocaleString("pt-BR")}%)</span>
          ) : null
        }
      />
      <div className="border-t border-border pt-1.5">
        <Linha
          rotulo="Sua comissão"
          valor={data.comissao}
          sinal="="
          destaque
          sufixo={
            data.congeladoEm ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Lock className="h-3 w-3" /> congelada em {formatDate(data.congeladoEm)}
              </span>
            ) : null
          }
        />
      </div>

      {(data.avisos || []).map((aviso) => (
        <p key={aviso} className="flex items-start gap-1.5 pt-1 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {aviso}
        </p>
      ))}
    </div>
  );
}
