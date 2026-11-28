import { describe, it, expect } from "vitest";
import {
  totalItensOS, valorCobradoOS, descontoEfetivoOS, valoresDoGrupoOS, classificarRecebimentoOS,
} from "./os-valor";

/** Soma bruta dos itens do grupo (mesmo cálculo de `grupoSubtotal`, antes do desconto). */
const somaItens = (itens: Array<{ valor_total: number }>) => itens.reduce((s, i) => s + i.valor_total, 0);
/** Espelha `grupoSubtotal` de orcamento-consolidado-pdf: bruto − desconto, nunca negativo. */
const subtotalGrupo = (g: { itens: Array<{ valor_total: number }>; desconto: number }) =>
  Math.max(0, somaItens(g.itens) - g.desconto);

describe("valorCobradoOS", () => {
  it("usa valor_final quando existe", () => {
    expect(valorCobradoOS({ valor_final: 2500, valor_orcamento: 3250, desconto: 750 }, 3250)).toBe(2500);
  });

  it("aplica o desconto sobre os itens quando não há valor_final", () => {
    expect(valorCobradoOS({ valor_final: 0, desconto: 750 }, 3250)).toBe(2500);
    expect(valorCobradoOS({ valor_final: 0, desconto: 100 }, 1000)).toBe(900);
  });

  it("cai no orçamento quando não há itens nem valor_final (OS antiga)", () => {
    expect(valorCobradoOS({ valor_final: null, valor_orcamento: 600, desconto: 50 }, 0)).toBe(600);
  });

  it("nunca devolve negativo", () => {
    expect(valorCobradoOS({ valor_final: 0, desconto: 150 }, 150)).toBe(0);
    expect(valorCobradoOS({ valor_final: null, valor_orcamento: null, desconto: 150 }, 0)).toBe(0);
  });

  it("trata nulos", () => {
    expect(valorCobradoOS(null, 100)).toBe(0);
  });
});

describe("descontoEfetivoOS", () => {
  it("é o desconto da coluna quando o valor_final é itens − desconto", () => {
    expect(descontoEfetivoOS({ valor_final: 2500, desconto: 750 }, 3250)).toBe(750);
  });

  it("inclui o efeito de um valor_final negociado", () => {
    // itens 650, desconto 50, valor_final negociado 570 -> desconto efetivo 80
    expect(descontoEfetivoOS({ valor_final: 570, desconto: 50 }, 650)).toBe(80);
  });

  it("usa o orçamento como base quando não há itens", () => {
    expect(descontoEfetivoOS({ valor_final: 570, valor_orcamento: 600 }, 0)).toBe(30);
  });

  it("é o desconto total quando o valor_final é menor que os itens", () => {
    // itens 1000, desconto da coluna 100, valor_final 850 -> desconto efetivo 150
    expect(descontoEfetivoOS({ valor_final: 850, desconto: 100 }, 1000)).toBe(150);
  });

  it("é zero quando não há desconto", () => {
    expect(descontoEfetivoOS({ valor_final: 0, desconto: 0 }, 100)).toBe(0);
  });
});

describe("totalItensOS", () => {
  it("soma e arredonda", () => {
    expect(totalItensOS([{ valor_total: 0.1 }, { valor_total: 0.2 }])).toBe(0.3);
    expect(totalItensOS(null)).toBe(0);
  });
});

describe("valoresDoGrupoOS (orçamento agrupado)", () => {
  it("OS sem itens não aplica o desconto duas vezes (orçamento 600, valor_final 570)", () => {
    const g = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: 570, desconto: 0 }, []);
    expect(somaItens(g.itens)).toBe(600); // linha sintética com o valor BRUTO
    expect(g.desconto).toBe(30);
    expect(subtotalGrupo(g)).toBe(570); // valor cobrado da OS, sem dupla aplicação
  });

  it("OS sem itens e sem valor_final usa o orçamento cheio", () => {
    const g = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: null, desconto: 0 }, []);
    expect(somaItens(g.itens)).toBe(600);
    expect(g.desconto).toBe(0);
    expect(subtotalGrupo(g)).toBe(600);
  });

  it("OS sem itens, sem orçamento, mas com valor_final, não perde o valor", () => {
    const g = valoresDoGrupoOS({ valor_orcamento: 0, valor_final: 570 }, []);
    expect(somaItens(g.itens)).toBe(570);
    expect(g.desconto).toBe(0);
    expect(subtotalGrupo(g)).toBe(570);
  });

  it("OS com itens desconta o desconto do cabeçalho uma única vez", () => {
    const itens = [{ tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 1000, valor_total: 1000 }];
    const g = valoresDoGrupoOS({ valor_final: 0, desconto: 100 }, itens);
    expect(somaItens(g.itens)).toBe(1000);
    expect(g.desconto).toBe(100);
    expect(subtotalGrupo(g)).toBe(900);
  });

  it("OS com itens e valor_final negociado traz o desconto efetivo total, sem duplicar", () => {
    const itens = [{ tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 1000, valor_total: 1000 }];
    const g = valoresDoGrupoOS({ valor_final: 850, desconto: 100 }, itens);
    expect(g.desconto).toBe(150); // 1000 − 850
    expect(subtotalGrupo(g)).toBe(850);
  });

  it("mantém os itens reais quando a OS tem itens", () => {
    const itens = [
      { tipo: "produto", descricao: "Hélice", quantidade: 2, valor_unitario: 50, valor_total: 100 },
      { tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 900, valor_total: 900 },
    ];
    const g = valoresDoGrupoOS({ valor_final: 0, desconto: 0 }, itens);
    expect(g.itens).toHaveLength(2);
    expect(subtotalGrupo(g)).toBe(1000);
  });

  it("agrupa duas OS com descontos diferentes e o desconto geral entra uma vez", () => {
    const osA = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: 570 }, []); // 570
    const osB = valoresDoGrupoOS({ valor_final: 0, desconto: 100 }, [
      { tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 1000, valor_total: 1000 },
    ]); // 900
    const subtotal = subtotalGrupo(osA) + subtotalGrupo(osB);
    expect(subtotal).toBe(1470);
    // Desconto adicional do orçamento agrupado: aplicado uma única vez sobre o subtotal.
    const total = Math.max(0, subtotal - 200);
    expect(total).toBe(1270);
  });
});

describe("classificarRecebimentoOS", () => {
  const mapa = <T,>(entries: Array<[string, T]>) => new Map<string, T>(entries);

  it("OS com itens, sem conta a receber, recebimento parcial fica Parcial", () => {
    // total real 900 (itens 1000 − 100); recebido 500
    const { pago, parcial } = classificarRecebimentoOS(mapa([["os1", 500]]), mapa([]), mapa([["os1", 900]]));
    expect([...parcial]).toEqual(["os1"]);
    expect(pago.size).toBe(0);
  });

  it("OS com itens, sem conta a receber, recebimento total fica Pago", () => {
    const { pago, parcial } = classificarRecebimentoOS(mapa([["os1", 900]]), mapa([]), mapa([["os1", 900]]));
    expect([...pago]).toEqual(["os1"]);
    expect(parcial.size).toBe(0);
  });

  it("OS sem itens (só orçamento), sem conta a receber, recebimento parcial fica Parcial", () => {
    const { parcial } = classificarRecebimentoOS(mapa([["os1", 300]]), mapa([]), mapa([["os1", 600]]));
    expect([...parcial]).toEqual(["os1"]);
  });

  it("OS sem itens, com valor_final, sem conta a receber, recebimento total fica Pago", () => {
    const { pago } = classificarRecebimentoOS(mapa([["os1", 570]]), mapa([]), mapa([["os1", 570]]));
    expect([...pago]).toEqual(["os1"]);
  });

  it("quando a conta a receber existe, o saldo dela decide", () => {
    const comSaldo = classificarRecebimentoOS(mapa([["os1", 400]]), mapa([["os1", { valor_recebido: 400, saldo: 200 }]]), mapa([]));
    expect([...comSaldo.parcial]).toEqual(["os1"]);
    const quitada = classificarRecebimentoOS(mapa([["os2", 600]]), mapa([["os2", { valor_recebido: 600, saldo: 0 }]]), mapa([]));
    expect([...quitada.pago]).toEqual(["os2"]);
  });

  it("sem recebimento lançado nada é classificado (nem pago nem parcial)", () => {
    const vazio = classificarRecebimentoOS(mapa([]), mapa([]), mapa([]));
    expect(vazio.pago.size).toBe(0);
    expect(vazio.parcial.size).toBe(0);
    const semPagamento = classificarRecebimentoOS(mapa([]), mapa([["os1", { valor_recebido: 0, saldo: 600 }]]), mapa([]));
    expect(semPagamento.pago.size).toBe(0);
    expect(semPagamento.parcial.size).toBe(0);
  });

  it("total desconhecido (0) não classifica a OS como paga", () => {
    const { pago, parcial } = classificarRecebimentoOS(mapa([["os1", 100]]), mapa([]), mapa([]));
    expect(pago.size).toBe(0);
    expect(parcial.size).toBe(0);
  });

  it("recebimento acima do total (sem conta) fica Pago", () => {
    const { pago } = classificarRecebimentoOS(mapa([["os1", 1000]]), mapa([]), mapa([["os1", 900]]));
    expect([...pago]).toEqual(["os1"]);
  });
});
