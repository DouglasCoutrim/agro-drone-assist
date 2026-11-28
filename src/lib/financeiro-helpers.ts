/**
 * Helpers compartilhados para cálculos financeiros.
 * Usado em Financeiro.tsx e Index.tsx para garantir consistência.
 */

export type TipoTransacao = "receita" | "despesa" | "salario" | "comissao";

export interface TransacaoFinanceira {
  tipo: string;
  valor: number;
  data_transacao: string;
}

/** Tipos que contam como despesa (saída de caixa). */
export const TIPOS_DESPESA: TipoTransacao[] = ["despesa", "salario", "comissao"];

/** Verifica se um tipo de transação é despesa. */
export function isDespesa(tipo: string): boolean {
  return TIPOS_DESPESA.includes(tipo as TipoTransacao);
}

/** Verifica se um tipo de transação é receita. */
export function isReceita(tipo: string): boolean {
  return tipo === "receita";
}

/** Soma as despesas de uma lista de transações (inclui despesa, salario e comissao). */
export function somarDespesas(transacoes: TransacaoFinanceira[]): number {
  return transacoes
    .filter(t => isDespesa(t.tipo))
    .reduce((acc, t) => acc + Number(t.valor || 0), 0);
}

/** Soma as receitas de uma lista de transações. */
export function somarReceitas(transacoes: TransacaoFinanceira[]): number {
  return transacoes
    .filter(t => isReceita(t.tipo))
    .reduce((acc, t) => acc + Number(t.valor || 0), 0);
}

/** Soma as comissões de uma lista de transações. */
export function somarComissoes(transacoes: TransacaoFinanceira[]): number {
  return transacoes
    .filter(t => t.tipo === "comissao")
    .reduce((acc, t) => acc + Number(t.valor || 0), 0);
}

/** Calcula o lucro líquido: receitas - despesas (incluindo comissões). */
export function calcularLucroLiquido(transacoes: TransacaoFinanceira[]): number {
  return somarReceitas(transacoes) - somarDespesas(transacoes);
}