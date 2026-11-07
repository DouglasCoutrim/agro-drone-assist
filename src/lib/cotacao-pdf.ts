import { gerarDocumentoPadrao, type EmpresaPDF } from "./pdf-padrao";

export interface CotacaoPDFData {
  numero: number | string;
  data: string;
  empresa: EmpresaPDF;
  fornecedor: { nome: string; cnpj?: string; telefone?: string; email?: string };
  itens: { codigo?: string; descricao: string; quantidade: number }[];
  observacoes?: string;
}

/** Solicitação de cotação (sem preços: o fornecedor preenche), no padrão visual do sistema. */
export function gerarCotacaoPDF(d: CotacaoPDFData) {
  const doc = gerarDocumentoPadrao({
    titulo: "Solicitação de cotação",
    numero: d.numero,
    linhasCabecalho: [`Emissão: ${d.data}`],
    empresa: d.empresa,
    parte: { rotulo: "Fornecedor", nome: d.fornecedor.nome || "-", detalhes: [d.fornecedor.cnpj ? `CNPJ: ${d.fornecedor.cnpj}` : "", d.fornecedor.telefone ? `Tel: ${d.fornecedor.telefone}` : "", d.fornecedor.email || ""] },
    tabela: {
      titulo: `Itens solicitados — ${d.itens.length}`,
      colunas: [{ titulo: "#", largura: 10 }, { titulo: "Código", largura: 26 }, { titulo: "Descrição" }, { titulo: "Qtd", largura: 16, alinhar: "right" }, { titulo: "Valor unit.", largura: 28, alinhar: "right" }, { titulo: "Total", largura: 28, alinhar: "right" }],
      linhas: d.itens.map((it, i) => [String(i + 1), it.codigo || "-", it.descricao, String(it.quantidade), "__________", "__________"]),
    },
    observacao: [d.observacoes, "Favor informar preço unitário, prazo de entrega, condições de pagamento e validade da proposta.\nPrazo de entrega: ______________   Cond. pagamento: ______________   Validade: ______________"].filter(Boolean).join("\n\n"),
    assinaturas: [d.empresa.nome || "Empresa", `${d.fornecedor.nome || "Fornecedor"} — Proposta`],
  });
  doc.save(`cotacao-${d.numero}-${(d.fornecedor.nome || "fornecedor").replace(/\W+/g, "_")}.pdf`);
}
