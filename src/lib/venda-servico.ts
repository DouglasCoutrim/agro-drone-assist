/** Serviços entram na venda sem produto do estoque e com NCM "00" (código de serviço). */
export const SERVICO_NCM = "00";

export function isServicoItem(item: { produto_id?: string | null; ncm?: string | null }): boolean {
  return !item.produto_id && (item.ncm || "").trim() === SERVICO_NCM;
}

/** NF-e (SEFAZ) aceita só mercadorias: vendas com serviço só podem gerar recibo. */
export function podeEmitirNfe(itens: { produto_id?: string | null; ncm?: string | null }[]): boolean {
  return !itens.some(isServicoItem);
}

export const MSG_NFE_COM_SERVICO =
  "Esta venda tem serviços junto com peças. A NF-e aceita somente produtos — use \"Emitir Recibo\" para faturar serviços e peças juntos.";
