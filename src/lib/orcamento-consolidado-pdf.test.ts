import { describe, it, expect } from "vitest";
import { groupsFromStoredItems, grupoSubtotal, type GroupedStoredItem } from "./orcamento-consolidado-pdf";
import { valoresDoGrupoOS } from "./os-valor";

describe("grupoSubtotal", () => {
  it("desconta o valor da OS uma única vez sobre a soma dos itens", () => {
    const g = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: 570 }, []);
    expect(grupoSubtotal({ os_numero: "OS-1", equipamento: "Drone", itens: g.itens, desconto: g.desconto })).toBe(570);
  });

  it("nunca devolve negativo", () => {
    const itens = [{ tipo: "servico", descricao: "x", quantidade: 1, valor_unitario: 100, valor_total: 100 }];
    expect(grupoSubtotal({ os_numero: "OS-1", equipamento: "Drone", itens, desconto: 150 })).toBe(0);
  });
});

describe("orçamento agrupado: PDF novo e PDF reaberto com o mesmo total", () => {
  it("reconstrói do banco o mesmo subtotal do grupo montado na tela", () => {
    // OS sem itens, orçamento 600, valor_final 570 → cobrado 570 (sem dupla aplicação)
    const osSemItens = valoresDoGrupoOS({ valor_orcamento: 600, valor_final: 570 }, []);
    // OS com itens 1000 e desconto de cabeçalho 100 → cobrado 900
    const osComItens = valoresDoGrupoOS({ valor_final: 0, desconto: 100 }, [
      { tipo: "servico", descricao: "Reparo", quantidade: 1, valor_unitario: 1000, valor_total: 1000 },
    ]);

    const naTela = [
      { os_numero: "OS-1", equipamento: "Drone A", itens: osSemItens.itens, desconto: osSemItens.desconto },
      { os_numero: "OS-2", equipamento: "Drone B", itens: osComItens.itens, desconto: osComItens.desconto },
    ];
    const subtotalNaTela = naTela.reduce((s, g) => s + grupoSubtotal(g), 0);
    expect(subtotalNaTela).toBe(1470);

    // O que vai para `orcamentos.itens` (GroupedStoredItem) carrega o `os_desconto`.
    const gravado: GroupedStoredItem[] = naTela.flatMap((g, idx) =>
      g.itens.map((i) => ({
        ...i,
        ordem_servico_id: `os${idx + 1}`,
        os_numero: g.os_numero,
        os_equipamento: g.equipamento,
        os_desconto: g.desconto,
      })),
    );

    // PDF reaberto: reconstrói os grupos a partir do que foi gravado.
    const reaberto = groupsFromStoredItems(gravado);
    const subtotalReaberto = reaberto.reduce((s, g) => s + grupoSubtotal(g), 0);
    expect(subtotalReaberto).toBe(subtotalNaTela);
    expect(subtotalReaberto).toBe(1470);
  });
});
