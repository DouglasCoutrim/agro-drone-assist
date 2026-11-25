/**
 * Definição ÚNICA de "valor da OS" no front.
 *
 * A mesma regra está no banco, em `public.os_commission_calc`:
 *   valor_cobrado = valor_final, ou (total dos itens − desconto) quando valor_final é 0.
 * Aqui há um último degrau para OS antigas sem itens, que é o `valor_orcamento`.
 *
 * Use sempre estas funções em vez de repetir a regra: era justamente a repetição que
 * fazia o orçamento agrupado mostrar a soma dos itens (sem o desconto da OS) enquanto a
 * tela da OS mostrava o valor final.
 */

export interface OsValorInput {
  valor_final?: number | null;
  valor_orcamento?: number | null;
  desconto?: number | null;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Soma dos itens da OS (0 quando não há itens). */
export function totalItensOS(itens: Array<{ valor_total?: number | null }> | null | undefined): number {
  return Math.round((itens || []).reduce((s, i) => s + num(i?.valor_total), 0) * 100) / 100;
}

/**
 * Valor efetivamente cobrado da OS.
 * Ordem: `valor_final` → (itens − desconto) → `valor_orcamento` (OS antigas sem itens).
 */
export function valorCobradoOS(os: OsValorInput | null | undefined, totalItens = 0): number {
  if (!os) return 0;
  const valorFinal = num(os.valor_final);
  if (valorFinal > 0) return valorFinal;
  if (totalItens > 0) return Math.max(0, totalItens - num(os.desconto));
  return Math.max(0, num(os.valor_orcamento));
}

/**
 * Desconto efetivo da OS sobre a soma dos itens. Inclui o efeito de um `valor_final`
 * negociado menor que os itens, não só a coluna `desconto`.
 */
export function descontoEfetivoOS(os: OsValorInput | null | undefined, totalItens = 0): number {
  if (!os) return 0;
  const bruto = totalItens > 0 ? totalItens : num(os.valor_orcamento);
  return Math.max(0, Math.round((bruto - valorCobradoOS(os, totalItens)) * 100) / 100);
}
