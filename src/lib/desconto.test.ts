import { describe, it, expect } from "vitest";
import {
  normalizarPercentual,
  tetoDesconto,
  limitarPercentualDesconto,
  calcularValorDesconto,
  calcularTotalComDesconto,
} from "./desconto";

describe("normalizarPercentual", () => {
  it("trata valores inválidos como 0", () => {
    expect(normalizarPercentual(undefined)).toBe(0);
    expect(normalizarPercentual(null)).toBe(0);
    expect(normalizarPercentual(NaN)).toBe(0);
    expect(normalizarPercentual(-5)).toBe(0);
  });

  it("nunca passa de 100", () => {
    expect(normalizarPercentual(150)).toBe(100);
  });
});

describe("limitarPercentualDesconto", () => {
  it("corta no máximo definido e sinaliza", () => {
    expect(limitarPercentualDesconto(30, 10)).toEqual({ percentual: 10, limitado: true });
  });

  it("mantém o valor quando dentro do máximo", () => {
    expect(limitarPercentualDesconto(7.5, 10)).toEqual({ percentual: 7.5, limitado: false });
  });

  it("sem máximo definido libera o desconto informado", () => {
    expect(limitarPercentualDesconto(5, 0)).toEqual({ percentual: 5, limitado: false });
    expect(limitarPercentualDesconto(5, undefined)).toEqual({ percentual: 5, limitado: false });
  });

  it("sem máximo definido ainda respeita o teto absoluto", () => {
    expect(limitarPercentualDesconto(150, 0)).toEqual({ percentual: 100, limitado: false });
  });
});

describe("tetoDesconto", () => {
  it("usa o teto do item quando definido", () => {
    expect(tetoDesconto(15)).toBe(15);
  });

  it("libera até 100 quando o teto não foi definido", () => {
    expect(tetoDesconto(0)).toBe(100);
    expect(tetoDesconto(undefined)).toBe(100);
    expect(tetoDesconto(null)).toBe(100);
  });
});

describe("calcularValorDesconto", () => {
  it("converte o percentual em R$ com 2 casas", () => {
    expect(calcularValorDesconto(2, 50, 10)).toBe(10);
    expect(calcularValorDesconto(1, 33.33, 10)).toBe(3.33);
  });

  it("sem desconto o valor é 0", () => {
    expect(calcularValorDesconto(3, 100, 0)).toBe(0);
  });
});

describe("calcularTotalComDesconto", () => {
  it("desconta do total", () => {
    expect(calcularTotalComDesconto(2, 50, 10)).toBe(90);
  });

  it("nunca fica negativo", () => {
    expect(calcularTotalComDesconto(1, 100, 100)).toBe(0);
  });
});
