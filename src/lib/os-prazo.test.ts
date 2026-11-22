import { describe, it, expect } from "vitest";
import { calcularPrazoOS, osEmAtraso, PRAZO_DIAGNOSTICO_PADRAO_HORAS } from "./os-prazo";

const ENTRADA = "2026-03-10T09:00:00.000Z";
const horas = (h: number) => h * 60 * 60 * 1000;
const depois = (h: number) => new Date(new Date(ENTRADA).getTime() + horas(h));

describe("calcularPrazoOS", () => {
  it("usa 48h por padrão no diagnóstico", () => {
    const prazo = calcularPrazoOS({ status: "recebido", data_entrada: ENTRADA }, depois(1));
    expect(prazo.fase).toBe("diagnostico");
    expect(prazo.emAtraso).toBe(false);
    expect(prazo.venceEm?.toISOString()).toBe(new Date(new Date(ENTRADA).getTime() + horas(PRAZO_DIAGNOSTICO_PADRAO_HORAS)).toISOString());
    expect(prazo.horasRestantes).toBeCloseTo(47, 5);
  });

  it("fica em atraso só depois do prazo de diagnóstico", () => {
    expect(osEmAtraso({ status: "aguardando_diagnostico", data_entrada: ENTRADA }, depois(47))).toBe(false);
    expect(osEmAtraso({ status: "aguardando_diagnostico", data_entrada: ENTRADA }, depois(49))).toBe(true);
  });

  it("respeita o prazo que o técnico estipulou para a OS", () => {
    const os = { status: "recebido", data_entrada: ENTRADA, prazo_diagnostico_horas: 72 };
    expect(osEmAtraso(os, depois(60))).toBe(false);
    expect(osEmAtraso(os, depois(73))).toBe(true);
  });

  it("não marca atraso enquanto aguarda aprovação do cliente", () => {
    const prazo = calcularPrazoOS(
      { status: "aguardando_aprovacao", data_entrada: ENTRADA, data_previsao: "2026-03-01T00:00:00.000Z" },
      depois(200),
    );
    expect(prazo.fase).toBe("aprovacao");
    expect(prazo.emAtraso).toBe(false);
    expect(prazo.venceEm).toBeNull();
  });

  it("depois do aceite, usa a previsão de entrega", () => {
    const os = { status: "aprovado", data_entrada: ENTRADA, data_previsao: "2026-03-20T00:00:00.000Z" };
    expect(osEmAtraso(os, new Date("2026-03-19T12:00:00.000Z"))).toBe(false);
    expect(osEmAtraso(os, new Date("2026-03-21T12:00:00.000Z"))).toBe(true);
    expect(calcularPrazoOS(os, new Date("2026-03-19T12:00:00.000Z")).fase).toBe("entrega");
  });

  it("não considera atrasada uma OS sem previsão nem prazo", () => {
    expect(calcularPrazoOS({ status: "aprovado", data_entrada: ENTRADA }).emAtraso).toBe(false);
    expect(calcularPrazoOS({ status: "recebido", data_entrada: null }).emAtraso).toBe(false);
  });

  it("nunca marca atraso em OS encerrada", () => {
    for (const status of ["concluida", "pronto_retirada", "entregue", "finalizada", "cancelada"]) {
      expect(osEmAtraso({ status, data_entrada: ENTRADA, data_previsao: "2026-03-01T00:00:00.000Z" }, depois(500))).toBe(false);
    }
  });
});
