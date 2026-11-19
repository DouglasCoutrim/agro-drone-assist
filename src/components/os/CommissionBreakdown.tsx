import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { TAXA_SEM_NOTA_PADRAO, type Rateio } from "@/lib/commission";
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
  /**
   * O rateio ainda não foi gravado pela regra nova (`commission_frozen_at` nulo): OS antiga,
   * calculada pela regra anterior, ou OS em aberto. Nada é corrigido em silêncio — o gestor
   * recalcula em lote em Comissões → Conferência da comissão.
   */
  semRateio?: boolean;
  /** Prévia da regra nova, usada para mostrar o que a OS passa a valer depois do recálculo. */
  previa?: Rateio | null;
  /** OS alterada depois do congelamento, ou concluída sem custo lançado. */
  avisos?: string[];
}

/** Lê o rateio gravado na OS (`ordens_servico.commission_*`). */
export function rateioDaOS(os: Record<string, unknown> | null | undefined, valorOs?: number | null): CommissionBreakdownData {
  const numero = (chave: string) => Number((os as Record<string, unknown> | null)?.[chave]) || 0;
  const base = numero("commission_base");
  const comissao = numero("commission_total");
  return {
    valorOs: valorOs ?? null,
    base,
    imposto: numero("commission_tax"),
    custo: numero("commission_cost"),
    saldo: base - numero("commission_tax") - numero("commission_cost"),
    loja: numero("commission_company"),
    taxaSemNota: numero("commission_no_note_fee"),
    comissao,
    aliquota: numero("commission_tax_rate"),
    taxaPercentual: TAXA_SEM_NOTA_PADRAO,
    nfeEmitida: Boolean((os as Record<string, unknown> | null)?.nfe_emitida),
    congeladoEm: ((os as Record<string, unknown> | null)?.commission_frozen_at as string | null) ?? null,
    semTecnico: !(os as Record<string, unknown> | null)?.tecnico_id,
    // Sem congelamento = o rateio ainda não foi gravado pela regra nova (OS antiga ou em aberto).
    semRateio: !((os as Record<string, unknown> | null)?.commission_frozen_at),
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

  // Sem rateio gravado e sem prévia não há o que abrir: mostra o valor gravado, sem inventar linhas.
  if (data.semRateio && !data.previa) {
    return (
      <div className={cn("rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-sm", className)}>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Rateio ainda não detalhado</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Comissão gravada (regra antiga)</span>
          <span className="font-mono tabular-nums">{formatCurrency(data.comissao)}</span>
        </div>
        <AvisoRecalculo />
      </div>
    );
  }

  // Com prévia, as linhas mostram a regra nova (o que a OS passa a valer) e a linha da regra antiga fica à parte.
  const p = data.previa;
  const usandoPrevia = Boolean(data.semRateio && p);
  const d = usandoPrevia && p
    ? {
        valorOs: data.valorOs,
        base: p.base,
        imposto: p.imposto,
        custo: p.custo,
        saldo: p.saldo,
        loja: p.loja,
        taxaSemNota: p.taxaSemNota,
        comissao: p.comissao,
        aliquota: p.aliquota,
        taxaPercentual: p.taxaPercentual,
      }
    : data;

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rateio do serviço</p>
        {usandoPrevia ? (
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
            <AlertTriangle className="h-3 w-3" /> Prévia — regra nova
          </Badge>
        ) : d.nfeEmitida ? (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600">
            <Shield className="h-3 w-3" /> Nota emitida
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
            <AlertTriangle className="h-3 w-3" /> Sem nota
          </Badge>
        )}
      </div>

      {d.valorOs != null && <Linha rotulo="Valor cobrado da OS" valor={d.valorOs} />}
      <Linha
        rotulo="Imposto da nota"
        valor={d.imposto}
        sinal="−"
        sufixo={d.nfeEmitida && d.aliquota > 0 ? <span className="text-xs">({d.aliquota}%)</span> : null}
      />
      <Linha rotulo="Custo do serviço" valor={d.custo} sinal="−" />
      <Linha rotulo="Saldo a dividir" valor={d.saldo} sinal="=" destaque />
      <div className="pl-4 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>Loja (50%)</span>
          <span className="font-mono tabular-nums">{formatCurrency(d.loja)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Você (50%)</span>
          <span className="font-mono tabular-nums">{formatCurrency(d.saldo - d.loja)}</span>
        </div>
      </div>
      <Linha
        rotulo="Taxa sem nota"
        valor={d.taxaSemNota}
        sinal="−"
        sufixo={
          !d.nfeEmitida ? (
            <span className="text-xs">({(d.taxaPercentual ?? TAXA_SEM_NOTA_PADRAO).toLocaleString("pt-BR")}%)</span>
          ) : null
        }
      />
      <div className="border-t border-border pt-1.5">
        <Linha
          rotulo={usandoPrevia ? "Sua comissão pela regra nova" : "Sua comissão"}
          valor={d.comissao}
          sinal="="
          destaque
          sufixo={
            !usandoPrevia && data.congeladoEm ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Lock className="h-3 w-3" /> congelada em {formatDate(data.congeladoEm)}
              </span>
            ) : null
          }
        />
      </div>

      {usandoPrevia && (
        <div className="space-y-1.5 border-t border-amber-500/30 pt-1.5">
          <Linha rotulo="Comissão gravada (regra antiga)" valor={data.comissao} />
          <AvisoRecalculo />
        </div>
      )}

      {(data.avisos || []).map((aviso) => (
        <p key={aviso} className="flex items-start gap-1.5 pt-1 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {aviso}
        </p>
      ))}
    </div>
  );
}

function AvisoRecalculo() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-700">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      Esta OS ainda mostra a comissão pela regra antiga. O valor passa a valer quando a OS é
      concluída ou quando o gestor recalcular em lote em Comissões → Conferência da comissão;
      nada é alterado sem essa ação.
    </p>
  );
}
