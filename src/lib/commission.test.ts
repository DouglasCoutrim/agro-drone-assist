import { describe, it, expect } from "vitest";
import { calcularRateio, TAXA_SEM_NOTA_PADRAO, type RateioItemInput } from "./commission";

const servico = (valorTotal: number, custoServico = 0): RateioItemInput => ({
  tipo: "servico",
  valorTotal,
  custoServico,
});
const peca = (valorTotal: number): RateioItemInput => ({ tipo: "produto", valorTotal });

const base = { nfeEmitida: false, taxaSemNota: TAXA_SEM_NOTA_PADRAO };

describe("rateio da comissão", () => {
  it("serviço de 800 com nota de 5% divide 760 em partes iguais", () => {
    const r = calcularRateio({ itens: [servico(800)], nfeEmitida: true, aliquota: 5 });
    expect(r.base).toBe(800);
    expect(r.imposto).toBe(40);
    expect(r.saldo).toBe(760);
    expect(r.loja).toBe(380);
    expect(r.comissao).toBe(380);
    expect(r.taxaSemNota).toBe(0);
  });

  it("serviço de 800 com nota de 6% divide 752", () => {
    const r = calcularRateio({ itens: [servico(800)], nfeEmitida: true, aliquota: 6 });
    expect(r.imposto).toBe(48);
    expect(r.loja).toBe(376);
    expect(r.comissao).toBe(376);
  });

  it("custo do serviço é abatido antes da divisão (nota 6%)", () => {
    const r = calcularRateio({
      itens: [servico(900, 150), peca(150)],
      nfeEmitida: true,
      aliquota: 6,
    });
    // Base = valor cobrado (itens - desconto quando valor_final é zero) = 1050
    expect(r.base).toBe(1050);
    expect(r.custo).toBe(150);
    expect(r.imposto).toBe(63);
    expect(r.saldo).toBe(837);
    expect(r.loja).toBe(418.5);
    expect(r.comissao).toBe(418.5);
  });

  it("sem nota aplica 3,5% sobre a parte do técnico", () => {
    const r = calcularRateio({
      ...base,
      itens: [servico(900, 150), peca(150)],
    });
    // Base = valor cobrado (itens - desconto quando valor_final é zero) = 1050
    expect(r.base).toBe(1050);
    expect(r.imposto).toBe(0);
    expect(r.saldo).toBe(900);
    expect(r.loja).toBe(450);
    expect(r.comissao).toBe(434.25);
    expect(r.taxaSemNota).toBe(15.75);
    expect(r.loja + r.taxaSemNota + r.comissao).toBe(900);
  });

  it("desconto do cabeçalho cai proporcionalmente sobre os serviços", () => {
    // 2.500 cobrados, 750 de desconto: se o valor final já é 2.500, a base é 2.500.
    const pago = calcularRateio({ ...base, itens: [servico(2500)], desconto: 750, valorOs: 2500 });
    expect(pago.base).toBe(2500);
    expect(pago.loja).toBe(1250);
    expect(pago.comissao).toBe(1206.25);

    const semValorFinal = calcularRateio({ ...base, itens: [servico(2500)], desconto: 750 });
    expect(semValorFinal.valorOs).toBe(1750);
    expect(semValorFinal.base).toBe(1750);
    expect(semValorFinal.comissao).toBe(844.38);
  });

  it("base é o valor cobrado (itens - desconto) quando valor_final é zero", () => {
    const r = calcularRateio({ ...base, itens: [servico(900), peca(300)], desconto: 200 });
    expect(r.totalItens).toBe(1200);
    expect(r.totalServicos).toBe(900);
    expect(r.valorOs).toBe(1000);
    expect(r.base).toBe(1000);
    expect(r.comissao).toBe(482.5);
  });

  it("saldo negativo vira zero, sem dívida para o técnico", () => {
    const r = calcularRateio({ ...base, itens: [servico(100, 500)] });
    expect(r.base).toBe(100);
    expect(r.saldo).toBe(0);
    expect(r.loja).toBe(0);
    expect(r.comissao).toBe(0);
  });

  it("OS sem itens não gera comissão", () => {
    const r = calcularRateio({ ...base, itens: [] });
    expect(r.base).toBe(0);
    expect(r.comissao).toBe(0);
  });

  it("OS sem técnico responsável não gera comissão", () => {
    const r = calcularRateio({ ...base, itens: [servico(800)], semTecnico: true });
    expect(r.comissao).toBe(0);
    expect(r.saldo).toBe(0);
    expect(r.loja).toBe(0);
  });

  it("taxa sem nota é configurável", () => {
    const r = calcularRateio({ itens: [servico(1000)], nfeEmitida: false, taxaSemNota: 10 });
    expect(r.loja).toBe(500);
    expect(r.comissao).toBe(450);
    expect(r.taxaSemNota).toBe(50);
  });
});
