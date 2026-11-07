import { describe, it, expect } from "vitest";
import { pedidoRevision, restorePedidoDraft, type PedidoSnapshot } from "./pedido-compra-draft";

const original: PedidoSnapshot = { setor: "estoque", titulo: "Reposição", obs: "", linhas: [
  { key: "1", id: "1", item_estoque_id: null, descricao: "Peça", quantidade: 1, status: "pendente" },
] };
const saved = JSON.stringify({ version: 2, base: pedidoRevision(original), snapshot: { ...original, titulo: "Alterado" } });

describe("rascunho de pedido", () => {
  it("abrir sem editar não muda a revisão", () => {
    expect(pedidoRevision(structuredClone(original))).toBe(pedidoRevision(original));
  });
  it("recupera alterações somente quando o pedido não mudou", () => {
    expect(restorePedidoDraft(saved, original)?.titulo).toBe("Alterado");
  });
  it("descarta status pendente antigo quando o item entrou em cotação", () => {
    expect(restorePedidoDraft(saved, { ...original, linhas: [{ ...original.linhas[0], status: "em_cotacao" }] })).toBeNull();
  });
  it("não exclui item adicionado depois do rascunho: descarta cópia antiga", () => {
    expect(restorePedidoDraft(saved, { ...original, linhas: [...original.linhas, { key: "2", id: "2", item_estoque_id: null, descricao: "Novo", quantidade: 1, status: "pendente" }] })).toBeNull();
  });
  it("descarta rascunhos legados sem revisão", () => {
    expect(restorePedidoDraft(JSON.stringify(original), original)).toBeNull();
  });
});