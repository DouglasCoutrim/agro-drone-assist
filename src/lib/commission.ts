/**
 * Prévia do rateio da comissão. A fórmula oficial vive no banco
 * (`public.calcular_valores_os` / `os_commission_core`) e esta função existe só para
 * mostrar o mesmo número na tela antes de salvar. `src/lib/commission.test.ts` trava os
 * dois lados nos mesmos exemplos: se um divergir, o teste quebra.
 *
 * Regra (por OS):
 *   valor_cobrado  = valor_final, ou (total dos itens - desconto) quando valor_final é 0
 *   base           = valor_cobrado (valor final da OS, após desconto)
 *   imposto        = com nota ? base x aliquota/100 : 0
 *   saldo          = max(base - imposto - custo do serviço - despesas adicionais, 0)
 *   loja           = saldo / 2            (parte do técnico é o resto, para somar exato)
 *   comissão       = com nota ? parte do técnico
 *                             : parte do técnico x (100 - taxa sem nota)/100
 *
 * A aritmética roda em centavos inteiros com arredondamento "meio para cima", igual ao
 * ROUND(numeric, 2) do Postgres. Sem nota, a comissão é arredondada direto (e não a taxa):
 * é o que reproduz os valores combinados — 900 de serviço + 150 de custo, sem nota, dá
 * 361,88 e não 361,87.
 */

export interface RateioItemInput {
  tipo: string;
  valorTotal: number;
  custoServico?: number | null;
}

export interface RateioInput {
  /** `ordens_servico.valor_final` (0 ou nulo usa itens - desconto). */
  valorOs?: number | null;
  desconto?: number | null;
  itens: RateioItemInput[];
  /** `nfe_config.nfse_aliquota` em %. */
  aliquota?: number | null;
  nfeEmitida?: boolean;
  /** `empresa_config.commission_no_note_fee` em %. */
  taxaSemNota?: number | null;
  /** OS sem técnico responsável não gera comissão. */
  semTecnico?: boolean;
}

export interface Rateio {
  valorOs: number;
  totalItens: number;
  totalServicos: number;
  base: number;
  imposto: number;
  custo: number;
  saldo: number;
  loja: number;
  parteBruta: number;
  taxaSemNota: number;
  comissao: number;
  aliquota: number;
  taxaPercentual: number;
  percentualTecnico: number;
}

export const TAXA_SEM_NOTA_PADRAO = 3.5;

const centavos = (valor: number | null | undefined) => {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Arredonda em centavos, meio para cima (mesmo comportamento do ROUND do Postgres). */
const arredonda = (valorCentavos: number) =>
  Math.sign(valorCentavos) * Math.round(Math.abs(valorCentavos));

const reais = (valorCentavos: number) => valorCentavos / 100;

const ZERADO: Rateio = {
  valorOs: 0,
  totalItens: 0,
  totalServicos: 0,
  base: 0,
  imposto: 0,
  custo: 0,
  saldo: 0,
  loja: 0,
  parteBruta: 0,
  taxaSemNota: 0,
  comissao: 0,
  aliquota: 0,
  taxaPercentual: TAXA_SEM_NOTA_PADRAO,
  percentualTecnico: 50,
};

export function calcularRateio(input: RateioInput): Rateio {
  const itens = input.itens || [];

  if (input.semTecnico) return { ...ZERADO };

  const totalItensC = itens.reduce((soma, item) => soma + centavos(item.valorTotal), 0);
  const totalServicosC = itens
    .filter((item) => item.tipo === "servico")
    .reduce((soma, item) => soma + centavos(item.valorTotal), 0);
  const custoC = itens.reduce((soma, item) => soma + centavos(item.custoServico), 0);

  const valorFinalC = centavos(input.valorOs);
  const descontoC = centavos(input.desconto);

  // Base = valor final da OS (após desconto). Se valor_final for nulo/zero, usar itens - desconto.
  let cobradoC = valorFinalC !== 0 ? valorFinalC : totalItensC - descontoC;
  if (cobradoC < 0) cobradoC = 0;

  // Base da comissão = valor cobrado (valor final da OS)
  let baseC = cobradoC;
  if (baseC < 0) baseC = 0;

  const nfeEmitida = !!input.nfeEmitida;
  const aliquota = nfeEmitida ? Math.max(0, Number(input.aliquota) || 0) : 0;
  const fee = nfeEmitida
    ? 0
    : Math.max(0, Number(input.taxaSemNota ?? TAXA_SEM_NOTA_PADRAO) || 0);

  const impostoC = aliquota > 0 ? arredonda((baseC * aliquota) / 100) : 0;

  let saldoC = baseC - impostoC - custoC;
  if (saldoC < 0) saldoC = 0;

  const lojaC = arredonda(saldoC / 2);
  const brutaC = saldoC - lojaC;

  let comissaoC: number;
  let taxC: number;
  if (nfeEmitida) {
    comissaoC = brutaC;
    taxC = 0;
  } else {
    comissaoC = arredonda((brutaC * (100 - fee)) / 100);
    taxC = brutaC - comissaoC;
  }

  return {
    valorOs: reais(cobradoC),
    totalItens: reais(totalItensC),
    totalServicos: reais(totalServicosC),
    base: reais(baseC),
    imposto: reais(impostoC),
    custo: reais(custoC),
    saldo: reais(saldoC),
    loja: reais(lojaC),
    parteBruta: reais(brutaC),
    taxaSemNota: reais(taxC),
    comissao: reais(comissaoC),
    aliquota,
    taxaPercentual: nfeEmitida ? 0 : fee,
    percentualTecnico: 50,
  };
}