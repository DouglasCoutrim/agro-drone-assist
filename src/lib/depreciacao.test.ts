import { describe, it, expect } from "vitest";
import { mesesDecorridos, valorDepreciado } from "./depreciacao";

describe("depreciação de ferramentas", () => {
  it("parafusadeira de R$ 1.200 em 24 meses vale R$ 700 após 10 meses (sem residual)", () => {
    expect(valorDepreciado(1200, 24, 0, 10).atual).toBe(700);
  });
  it("nunca fica abaixo do valor residual", () => {
    expect(valorDepreciado(1000, 12, 10, 50).atual).toBe(100);
  });
  it("conta apenas meses completos", () => {
    expect(mesesDecorridos("2026-01-15", new Date(2026, 3, 14))).toBe(2);
    expect(mesesDecorridos("2026-01-15", new Date(2026, 3, 15))).toBe(3);
  });
});
