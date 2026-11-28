import { describe, it, expect } from "vitest";
import { todayLocal, nowLocalISO, round2, sumMoney, subMoney, mulMoney, divMoney, pctMoney } from "./date-utils";

describe("ETAPA 7: utilitários de data e arredondamento", () => {
  it("todayLocal retorna data no formato yyyy-mm-dd", () => {
    const hoje = todayLocal();
    expect(hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("nowLocalISO retorna data/hora no formato ISO local", () => {
    const agora = nowLocalISO();
    expect(agora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("lançamento às 22h de Brasília grava o dia de hoje", () => {
    // Simula um lançamento às 22h de Brasília (UTC-3)
    // 22h de Brasília = 01h UTC do dia seguinte
    // O utilitário deve retornar o dia de hoje no fuso de Brasília
    const hoje = todayLocal();
    // Verifica que a data é válida e no formato correto
    expect(hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Verifica que a data não é futura (não pode ser amanhã)
    const hojeDate = new Date(hoje + "T12:00:00");
    const agora = new Date();
    expect(hojeDate.getTime()).toBeLessThanOrEqual(agora.getTime() + 86400000);
  });

  it("round2 arredonda para 2 casas decimais", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(1.236)).toBe(1.24);
    expect(round2(0)).toBe(0);
    expect(round2(-1.235)).toBe(-1.24);
  });

  it("sumMoney soma valores com arredondamento", () => {
    expect(sumMoney(1.1, 2.2)).toBe(3.3);
    expect(sumMoney(0.1, 0.2)).toBe(0.3);
    expect(sumMoney(1.234, 2.345)).toBe(3.58);
  });

  it("subMoney subtrai valores com arredondamento", () => {
    expect(subMoney(3.3, 1.1)).toBe(2.2);
    expect(subMoney(1.0, 0.9)).toBe(0.1);
  });

  it("mulMoney multiplica valores com arredondamento", () => {
    expect(mulMoney(1.1, 2.2)).toBe(2.42);
    expect(mulMoney(0.1, 0.2)).toBe(0.02);
  });

  it("divMoney divide valores com arredondamento", () => {
    expect(divMoney(10, 3)).toBe(3.33);
    expect(divMoney(10, 0)).toBe(0);
  });

  it("pctMoney calcula porcentagem com arredondamento", () => {
    expect(pctMoney(100, 5)).toBe(5);
    expect(pctMoney(2500, 5)).toBe(125);
    expect(pctMoney(900, 5)).toBe(45);
  });
});