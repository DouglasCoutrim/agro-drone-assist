import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { TAXA_SEM_NOTA_PADRAO, type Rateio } from "@/lib/commission";
import { AlertTriangle, Lock, Shield, SlidersHorizontal } from "lucide-react";

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
  /** Valor do ajuste manual (admin) gravado na OS; `null` quando a comissão segue a regra. */
  override?: number | null;
  /** Motivo informado pelo administrador ao ajustar a comissão. */
  overrideMotivo?: string | null;
  /** Comissão que a regra produziria agora — usada para mostrar a diferença do ajuste. */
  calculada?: number | null;
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
  const registro = os as Record<string, unknown> | null;
  const numero = (chave: string) => Number(registro?.[chave]) || 0;
  const opcional = (chave: string) => {
    const bruto = registro?.[chave];
    return bruto === null || bruto === undefined || bruto === "" ? null : Number(bruto);
  };
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
    nfeEmitida: Boolean(registro?.nfe_emitida),
    congeladoEm: (registro?.commission_frozen_at as string | null) ?? null,
    semTecnico: !registro?.tecnico_id,
    override: opcional("commission_override"),
    overrideMotivo: (registro?.commission_override_reason as string | null) ?? null,
    // Sem congelamento = o rateio ainda não foi gravado pela regra nova (OS antiga ou em aberto).
    semRateio: !registro?.commission_frozen_at,
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

  // Ajuste manual (admin): a OS tem um valor de comissão definido à mão. Nesse caso o rateio
  // gravado já inclui o ajuste (a loja absorve a diferença), então ele é a fonte da verdade.
  const ajustado = data.override != null;
  const calculada = ajustado ? data.calculada ?? null : null;
  const ajuste = calculada != null ? Math.round((Number(data.comissao || 0) - calculada) * 100) / 100 : null;

  // Sem rateio gravado e sem prévia não há o que abrir: mostra o valor gravado, sem inventar linhas.
  if (data.semRateio && !data.previa && !ajustado) {
    return (
      <div className={cn("rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-sm", className)}>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Rateio ainda não gravado</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Comissão gravada</span>
          <span className="font-mono tabular-nums">{formatCurrency(data.comissao)}</span>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          O rateio é gravado quando a OS é concluída — até lá o valor é uma prévia.
        </p>
      </div>
    );
  }

  // Com prévia, as linhas mostram a regra nova (o que a OS passa a valer) e a linha da regra
  // antiga fica à parte — mas só quando o valor gravado realmente difere da prévia. Depois do
  // recálculo em lote o gravado já é a regra nova, e repetir o mesmo número só confunde.
  // Com ajuste manual a prévia não se aplica: o valor gravado é a decisão do administrador.
  const p = data.previa;
  const usandoPrevia = Boolean(data.semRateio && p && !ajustado);
  const divergenteDaPrevia = usandoPrevia && !!p
    && Math.abs(Number(data.comissao || 0) - p.comissao) >= 0.005;
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
        nfeEmitida: data.nfeEmitida,
      }
    : data;

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-3 space-y-1.5 text-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rateio do serviço</p>
        <div className="flex items-center gap-1.5">
          {ajustado && (
            <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
              <SlidersHorizontal className="h-3 w-3" /> Ajuste manual
            </Badge>
          )}
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
          <span>{ajustado ? "Loja (absorve o ajuste)" : "Loja (50%)"}</span>
          <span className="font-mono tabular-nums">{formatCurrency(d.loja)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>{ajustado ? "Você" : "Você (50%)"}</span>
          <span className="font-mono tabular-nums">{formatCurrency(d.saldo - d.loja)}</span>
        </div>
      </div>
      {!ajustado && (
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
      )}
      <div className="border-t border-border pt-1.5">
        {ajustado && calculada != null && (
          <Linha rotulo="Comissão pela regra" valor={calculada} sufixo={<span className="text-xs">(não aplicada)</span>} />
        )}
        {ajustado && ajuste != null && (
          <Linha
            rotulo="Ajuste manual (admin)"
            valor={Math.abs(ajuste)}
            sinal={ajuste >= 0 ? "+" : "−"}
          />
        )}
        <Linha
          rotulo={usandoPrevia ? "Sua comissão pela regra nova" : ajustado ? "Sua comissão ajustada" : "Sua comissão"}
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

      {ajustado && (
        <p className="text-xs text-muted-foreground">
          {data.overrideMotivo
            ? `Motivo do ajuste: ${data.overrideMotivo}`
            : "Comissão definida manualmente por um administrador."}
        </p>
      )}

      {divergenteDaPrevia && (
        <div className="space-y-1.5 border-t border-amber-500/30 pt-1.5">
          <Linha rotulo="Comissão gravada (fora da regra nova)" valor={data.comissao} />
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
      O valor gravado nesta OS está fora da regra nova. O gestor recalcula em lote em
      Comissões → Conferência da comissão; nada é alterado sem essa ação.
    </p>
  );
}
