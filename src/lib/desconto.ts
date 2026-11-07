/**
 * Regras de desconto por item.
 *
 * O usuário informa um percentual e o sistema converte em R$. O percentual é
 * sempre limitado ao teto definido pelo administrador para o item
 * (`desconto_maximo_percentual`).
 */

/** Teto absoluto aceito, independente da configuração do item. */
export const PERCENTUAL_DESCONTO_MAXIMO = 100;

/** Normaliza um percentual: números inválidos viram 0 e o teto absoluto é respeitado. */
export function normalizarPercentual(valor: number | null | undefined): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, PERCENTUAL_DESCONTO_MAXIMO);
}

/**
 * Limita o percentual pedido ao máximo permitido pelo item.
 * `limitado` indica que o valor foi cortado e o usuário deve ser avisado.
 */
export function limitarPercentualDesconto(
  percentual: number | null | undefined,
  maximo: number | null | undefined,
): { percentual: number; limitado: boolean } {
  const max = Math.max(0, Number(maximo) || 0);
  const pedido = normalizarPercentual(percentual);
  if (pedido > max) return { percentual: max, limitado: true };
  return { percentual: pedido, limitado: false };
}

/** Valor do desconto em R$ (2 casas) a partir do percentual. */
export function calcularValorDesconto(
  quantidade: number,
  valorUnitario: number,
  percentual: number,
): number {
  const base = (Number(quantidade) || 0) * (Number(valorUnitario) || 0);
  const pct = normalizarPercentual(percentual);
  return Math.round(base * pct) / 100;
}

/** Total do item já com o desconto aplicado. */
export function calcularTotalComDesconto(
  quantidade: number,
  valorUnitario: number,
  percentual: number,
): number {
  const base = (Number(quantidade) || 0) * (Number(valorUnitario) || 0);
  const valor = calcularValorDesconto(quantidade, valorUnitario, percentual);
  return Math.max(0, Math.round((base - valor) * 100) / 100);
}
