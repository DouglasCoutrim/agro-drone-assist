import { describe, it, expect } from "vitest";
import { totalItensOS, valorCobradoOS, descontoEfetivoOS } from "./os-valor";

describe("valorCobradoOS", () => {
  it("usa valor_final quando existe", () => {
    expect(valorCobradoOS({ valor_final: 2500, valor_orcamento: 3250, desconto: 750 }, 3250)).toBe(2500);
  });

  it("aplica o desconto sobre os itens quando não há valor_final", () => {
    expect(valorCobradoOS({ valor_final: 0, desconto: 750 }, 3250)).toBe(2500);
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
