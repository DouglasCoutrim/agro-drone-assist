export type PedidoLinha = { key: string; id?: string; item_estoque_id: string | null; descricao: string; quantidade: number; status?: string; codigo?: string };
export type PedidoSnapshot = { setor: string; titulo: string; obs: string; linhas: PedidoLinha[] };

export function pedidoRevision(snapshot: PedidoSnapshot): string {
  return JSON.stringify({
    setor: snapshot.setor, titulo: snapshot.titulo, obs: snapshot.obs,
    linhas: snapshot.linhas.map(({ key, id, item_estoque_id, descricao, quantidade, status }) =>
      ({ key, id, item_estoque_id, descricao, quantidade, status })).sort((a, b) => a.key.localeCompare(b.key)),
  });
}

export function restorePedidoDraft(raw: string | null, original: PedidoSnapshot): PedidoSnapshot | null {
  try {
    const draft = JSON.parse(raw || "null");
    if (draft?.version !== 2 || draft.base !== pedidoRevision(original) || !Array.isArray(draft.snapshot?.linhas)) return null;
    return draft.snapshot;
  } catch { return null; }
}