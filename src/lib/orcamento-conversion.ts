/** Combined quotes reference existing orders and must never create another OS. */
export function canConvertOrcamento(orc: {
  status: string;
  ordem_servico_id: string | null;
  itens?: unknown;
}): boolean {
  const grouped = Array.isArray(orc.itens) && orc.itens.some((item) =>
    item && (typeof item.os_numero === "string" || typeof item.ordem_servico_id === "string"),
  );
  return orc.status === "pendente" && !orc.ordem_servico_id && !grouped;
}