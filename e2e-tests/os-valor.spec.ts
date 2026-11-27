import { test, expect } from "@playwright/test";
import { groupsFromStoredItems, grupoSubtotal, type GroupedStoredItem } from "../src/lib/orcamento-consolidado-pdf";
import { classificarRecebimentoOS, descontoEfetivoOS, valorCobradoOS, valoresDoGrupoOS } from "../src/lib/os-valor";

/**
 * Regressão dos bloqueadores corrigidos em ca8cc3f9:
 *  - o valor da OS no orçamento agrupado não pode aplicar o desconto duas vezes;
 *  - o fallback de recebimentos antigos (sem conta a receber) tem de usar o valor real da OS.
 *
 * São funções puras: o teste roda no worker do Playwright, sem navegar.
 */
const mapa = <T,>(entries: Array<[string, T]>) => new Map<string, T>(entries);

test.describe("valor da OS no orçamento agrupado", () => {
  test("OS sem itens não aplica o desconto duas vezes (orçamento 600, valor_final 570)", () => {
    const g = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: 570, desconto: 0 }, []);
    expect(grupoSubtotal({ os_numero: "OS-1", equipamento: "Drone", itens: g.itens, desconto: g.desconto })).toBe(570);
  });

  test("OS sem itens e sem valor_final usa o orçamento cheio", () => {
    const g = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: null }, []);
    expect(grupoSubtotal({ os_numero: "OS-1", equipamento: "Drone", itens: g.itens, desconto: g.desconto })).toBe(600);
  });

  test("OS com itens desconta o cabeçalho uma única vez", () => {
    const g = valoresDoGrupoOS({ valor_final: 0, desconto: 100 }, [
      { tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 1000, valor_total: 1000 },
    ]);
    expect(g.desconto).toBe(100);
    expect(grupoSubtotal({ os_numero: "OS-1", equipamento: "Drone", itens: g.itens, desconto: g.desconto })).toBe(900);
  });

  test("valor_final negociado vira desconto efetivo total, sem duplicar", () => {
    const itens = [{ tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 1000, valor_total: 1000 }];
    expect(descontoEfetivoOS({ valor_final: 850, desconto: 100 }, 1000)).toBe(150);
    const g = valoresDoGrupoOS({ valor_final: 850, desconto: 100 }, itens);
    expect(grupoSubtotal({ os_numero: "OS-1", equipamento: "Drone", itens: g.itens, desconto: g.desconto })).toBe(850);
  });

  test("PDF novo e PDF reaberto dão o mesmo total", () => {
    const a = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: 570 }, []);
    const b = valoresDoGrupoOS({ valor_final: 0, desconto: 100 }, [
      { tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 1000, valor_total: 1000 },
    ]);
    const gravado: GroupedStoredItem[] = [
      ...a.itens.map((i) => ({ ...i, ordem_servico_id: "os1", os_numero: "OS-1", os_equipamento: "Drone A", os_desconto: a.desconto })),
      ...b.itens.map((i) => ({ ...i, ordem_servico_id: "os2", os_numero: "OS-2", os_equipamento: "Drone B", os_desconto: b.desconto })),
    ];
    const reaberto = groupsFromStoredItems(gravado);
    expect(reaberto.reduce((s, g) => s + grupoSubtotal(g), 0)).toBe(1470);
  });
});

test.describe("recebimentos antigos (sem conta a receber)", () => {
  test("OS com itens e recebimento parcial fica Parcial", () => {
    const { pago, parcial } = classificarRecebimentoOS(mapa([["os1", 500]]), mapa([]), mapa([["os1", 900]]));
    expect([...parcial]).toEqual(["os1"]);
    expect(pago.size).toBe(0);
  });

  test("OS com itens e recebimento total fica Pago", () => {
    const { pago } = classificarRecebimentoOS(mapa([["os1", 900]]), mapa([]), mapa([["os1", 900]]));
    expect([...pago]).toEqual(["os1"]);
  });

  test("sem conta e sem total apurado não marca a OS como paga", () => {
    const { pago, parcial } = classificarRecebimentoOS(mapa([["os1", 100]]), mapa([]), mapa([]));
    expect(pago.size).toBe(0);
    expect(parcial.size).toBe(0);
  });

  test("conta a receber com saldo decide Parcial", () => {
    const { parcial } = classificarRecebimentoOS(
      mapa([["os1", 400]]),
      mapa([["os1", { valor_recebido: 400, saldo: 200 }]]),
      mapa([]),
    );
    expect([...parcial]).toEqual(["os1"]);
  });

  test("valorCobradoOS usa os itens quando não há valor_final", () => {
    expect(valorCobradoOS({ valor_final: 0, desconto: 100 }, 1000)).toBe(900);
  });
});
