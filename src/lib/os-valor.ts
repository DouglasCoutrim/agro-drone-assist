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

export interface OsItemValor {
  tipo?: string | null;
  descricao?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  valor_total?: number | null;
}

export interface GrupoValores {
  /** Itens do grupo: os itens reais da OS, ou uma linha sintética com o bruto do orçamento. */
  itens: Array<{ tipo: string; descricao: string; quantidade: number; valor_unitario: number; valor_total: number }>;
  /** Desconto da própria OS sobre o bruto do grupo (aplicado uma única vez). */
  desconto: number;
}

/**
 * Itens e desconto de um grupo do orçamento agrupado para uma OS.
 *
 * Sem itens, a OS entra como uma linha sintética com o valor **bruto** do orçamento
 * (nunca com o valor já líquido): assim o desconto da própria OS é aplicado uma única
 * vez em `grupoSubtotal` e o resultado é o valor cobrado — `bruto − desconto =
 * valorCobradoOS`. Era justamente aplicar o desconto sobre um item já líquido que
 * fazia a OS sem itens cobrar a menos (ex.: orçamento 600, valor_final 570 → 540).
 */
export function valoresDoGrupoOS(
  os: OsValorInput | null | undefined,
  itens: OsItemValor[] | null | undefined,
): GrupoValores {
  const lista = itens || [];
  const temItens = lista.length > 0;
  const totalItens = totalItensOS(lista);
  const cobrado = valorCobradoOS(os, temItens ? totalItens : 0);
  // Bruto do grupo: a soma dos itens; sem itens, o orçamento salvo — nunca menor que o
  // cobrado, para um `valor_final` negociado não desaparecer.
  const bruto = temItens ? totalItens : Math.max(num(os?.valor_orcamento), cobrado);
  const itensGrupo = temItens
    ? lista.map((i) => ({
        tipo: i.tipo || "servico",
        descricao: i.descricao || "Item",
        quantidade: num(i.quantidade),
        valor_unitario: num(i.valor_unitario),
        valor_total: num(i.valor_total),
      }))
    : bruto > 0
      ? [{ tipo: "servico", descricao: "Serviço conforme valor da OS", quantidade: 1, valor_unitario: bruto, valor_total: bruto }]
      : [];
  return { itens: itensGrupo, desconto: descontoEfetivoOS(os, temItens ? totalItens : 0) };
}

export interface ContaReceberResumo {
  valor_recebido?: number | null;
  saldo?: number | null;
}

export interface RecebimentosClassificados {
  /** OS quitadas (sem saldo em aberto). */
  pago: Set<string>;
  /** OS com receita lançada e saldo em aberto. */
  parcial: Set<string>;
}

/**
 * Decide quais OS estão pagas e quais têm recebimento parcial.
 *
 * `recebidoPorOS` traz só receitas (`financeiro.tipo = 'receita'`) — despesa e comissão
 * também apontam para a OS, mas não são recebimento. Quando a OS tem conta a receber, o
 * saldo dela manda; sem conta (recebimento antigo), a decisão usa `totalPorOS` — o valor
 * cobrado real da OS, **com os itens** —, nunca um total zerado. Nada é classificado
 * quando não há recebimento lançado; e, sem conta nem total confiável, a OS fica de fora
 * em vez de ser marcada como paga.
 */
export function classificarRecebimentoOS(
  recebidoPorOS: Map<string, number>,
  contasPorOS: Map<string, ContaReceberResumo>,
  totalPorOS: Map<string, number>,
): RecebimentosClassificados {
  const pago = new Set<string>();
  const parcial = new Set<string>();
  const ids = new Set<string>([...recebidoPorOS.keys(), ...contasPorOS.keys()]);
  ids.forEach((osId) => {
    const conta = contasPorOS.get(osId);
    const recebido = Number(conta?.valor_recebido ?? recebidoPorOS.get(osId) ?? 0);
    if (recebido <= 0.005) return;
    if (conta) {
      if (Number(conta.saldo ?? 0) > 0.005) parcial.add(osId); else pago.add(osId);
      return;
    }
    // Recebimento antigo, sem conta a receber: decide pelo valor real da OS. Sem total
    // confiável (0/ausente) não classificamos — não marcamos como paga uma OS cujo valor
    // não conseguimos apurar.
    const total = totalPorOS.get(osId) || 0;
    if (total <= 0.005) return;
    if (recebido < total - 0.005) parcial.add(osId); else pago.add(osId);
  });
  return { pago, parcial };
}
