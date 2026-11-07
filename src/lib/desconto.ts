/**
 * Regras de desconto por item.
 *
 * O usuário informa um percentual e o sistema converte em R$. O percentual é
 * limitado ao teto definido pelo administrador para o item
 * (`desconto_maximo_percentual`); quando o teto não é definido (0), o item
 * fica liberado até o teto absoluto.
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
 * Teto de desconto efetivo do item.
 * Quando o administrador não define um teto (0 ou vazio), o item fica liberado
 * até o teto absoluto — assim o desconto informado é aplicado normalmente.
 */
export function tetoDesconto(maximo: number | null | undefined): number {
  const max = Number(maximo);
  if (!Number.isFinite(max) || max <= 0) return PERCENTUAL_DESCONTO_MAXIMO;
  return Math.min(max, PERCENTUAL_DESCONTO_MAXIMO);
}

/**
 * Limita o percentual pedido ao teto permitido pelo item.
 * `limitado` indica que o valor foi cortado e o usuário deve ser avisado.
 */
export function limitarPercentualDesconto(
  percentual: number | null | undefined,
  maximo: number | null | undefined,
): { percentual: number; limitado: boolean } {
  const max = tetoDesconto(maximo);
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
