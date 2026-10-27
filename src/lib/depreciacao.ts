/** Meses completos entre a aquisição e a data de referência. */
export function mesesDecorridos(aquisicao: string | Date, ref: Date = new Date()): number {
  const a = typeof aquisicao === "string" ? new Date(aquisicao + (aquisicao.length === 10 ? "T00:00:00" : "")) : aquisicao;
  let m = (ref.getFullYear() - a.getFullYear()) * 12 + (ref.getMonth() - a.getMonth());
  if (ref.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

/** Depreciação linear mensal até o valor residual mínimo (percentual do valor de compra). */
export function valorDepreciado(valor: number, vidaUtilMeses: number, residualPct: number, meses: number) {
  const residual = valor * (residualPct / 100);
  const vida = Math.max(1, vidaUtilMeses);
  const mensal = (valor - residual) / vida;
  const atual = Math.max(residual, valor - mensal * meses);
  return { mensal: round(mensal), atual: round(atual), depreciado: round(valor - atual) };
}

const round = (n: number) => Math.round(n * 100) / 100;
