import { jsPDF } from "jspdf";

export interface CotacaoPDFData {
  numero: number | string;
  data: string;
  empresa: { nome: string; cnpj?: string | null; telefone?: string | null; endereco?: string | null };
  fornecedor: { nome: string; cnpj?: string; telefone?: string; email?: string };
  itens: { codigo?: string; descricao: string; quantidade: number }[];
}

/** Gera o PDF de solicitação de cotação para um fornecedor (sem preços: o fornecedor preenche). */
export function gerarCotacaoPDF(d: CotacaoPDFData) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 18;
  doc.setFont("helvetica", "bold").setFontSize(15).text(d.empresa.nome || "Empresa", 14, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const info = [d.empresa.cnpj && `CNPJ ${d.empresa.cnpj}`, d.empresa.telefone, d.empresa.endereco].filter(Boolean).join(" · ");
  if (info) doc.text(info, 14, (y += 5));
  doc.setFont("helvetica", "bold").setFontSize(13).text(`SOLICITAÇÃO DE COTAÇÃO Nº ${d.numero}`, W - 14, 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).text(`Data: ${d.data}`, W - 14, 23, { align: "right" });
  y += 6; doc.line(14, y, W - 14, y); y += 7;
  doc.setFont("helvetica", "bold").setFontSize(10).text("Fornecedor", 14, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  y += 5; doc.text(d.fornecedor.nome || "-", 14, y);
  const f = [d.fornecedor.cnpj && `CNPJ ${d.fornecedor.cnpj}`, d.fornecedor.telefone, d.fornecedor.email].filter(Boolean).join(" · ");
  if (f) { y += 5; doc.text(f, 14, y); }
  y += 9;
  const header = () => {
    doc.setFillColor(235, 235, 235).rect(14, y - 5, W - 28, 7, "F");
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text("#", 16, y); doc.text("Código", 24, y); doc.text("Descrição", 52, y);
    doc.text("Qtd", 130, y, { align: "right" }); doc.text("Valor unit.", 160, y, { align: "right" }); doc.text("Total", W - 16, y, { align: "right" });
    doc.setFont("helvetica", "normal"); y += 7;
  };
  header();
  d.itens.forEach((it, i) => {
    const lines = doc.splitTextToSize(it.descricao, 70) as string[];
    const h = lines.length * 4.5 + 3;
    if (y + h > H - 40) { doc.addPage(); y = 20; header(); }
    doc.text(String(i + 1), 16, y); doc.text(it.codigo || "-", 24, y); doc.text(lines, 52, y);
    doc.text(String(it.quantidade), 130, y, { align: "right" });
    doc.text("________", 160, y, { align: "right" }); doc.text("________", W - 16, y, { align: "right" });
    y += h; doc.setDrawColor(220).line(14, y - 3, W - 14, y - 3);
  });
  if (y > H - 45) { doc.addPage(); y = 20; }
  y += 6;
  doc.setFontSize(9).text("Favor informar preço unitário, prazo de entrega, condições de pagamento e validade da proposta.", 14, y);
  y += 6; doc.text("Prazo de entrega: ____________   Cond. pagamento: ____________   Validade: ____________", 14, y);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(8).text(`Página ${p} de ${pages}`, W - 14, H - 8, { align: "right" }); }
  doc.save(`cotacao-${d.numero}-${(d.fornecedor.nome || "fornecedor").replace(/\W+/g, "_")}.pdf`);
}
