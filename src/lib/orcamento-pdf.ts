import { jsPDF } from "jspdf";
import { formatCurrency } from "./formatters";

export interface OrcamentoItemPDF {
  tipo: "produto" | "servico";
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface OrcamentoPDFData {
  numero?: string;
  cliente: string;
  cliente_telefone?: string;
  equipamento: string;
  descricao: string;
  itens: OrcamentoItemPDF[];
  subtotal: number;
  desconto: number;
  total: number;
  validade: string;
  empresa: {
    nome: string;
    telefone?: string;
    cnpj?: string;
    endereco?: string;
  };
  termos?: string;
}

export function generateOrcamentoPDF(data: OrcamentoPDFData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  let y = 15;

  // Header
  doc.setFontSize(18).setFont("helvetica", "bold");
  doc.text(data.empresa.nome, M, y);
  y += 6;
  doc.setFontSize(9).setFont("helvetica", "normal");
  if (data.empresa.cnpj) { doc.text(`CNPJ: ${data.empresa.cnpj}`, M, y); y += 4; }
  if (data.empresa.endereco) { doc.text(data.empresa.endereco, M, y); y += 4; }
  if (data.empresa.telefone) { doc.text(`Tel: ${data.empresa.telefone}`, M, y); y += 4; }

  y += 4;
  doc.setDrawColor(57, 255, 20);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 8;

  // Title
  doc.setFontSize(14).setFont("helvetica", "bold");
  doc.text(`ORÇAMENTO${data.numero ? ` Nº ${data.numero}` : ""}`, M, y);
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`Validade: ${data.validade}`, W - M, y, { align: "right" });
  y += 8;

  // Client
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("CLIENTE", M, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(data.cliente, M, y); y += 4;
  if (data.cliente_telefone) { doc.text(`Tel: ${data.cliente_telefone}`, M, y); y += 4; }
  y += 2;

  // Equipment
  if (data.equipamento) {
    doc.setFont("helvetica", "bold");
    doc.text("EQUIPAMENTO / OBJETO", M, y); y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.equipamento, W - 2 * M);
    doc.text(lines, M, y); y += lines.length * 4 + 2;
  }

  // Description
  if (data.descricao) {
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIÇÃO", M, y); y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.descricao, W - 2 * M);
    doc.text(lines, M, y); y += lines.length * 4 + 2;
  }

  // Items table
  if (data.itens.length > 0) {
    y += 2;
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.setFillColor(240, 240, 240);
    doc.rect(M, y - 4, W - 2 * M, 6, "F");
    doc.text("Item", M + 2, y);
    doc.text("Qtd", W - M - 50, y, { align: "right" });
    doc.text("Unit.", W - M - 25, y, { align: "right" });
    doc.text("Total", W - M - 2, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal").setFontSize(9);
    for (const it of data.itens) {
      if (y > 260) { doc.addPage(); y = 20; }
      const desc = `${it.tipo === "servico" ? "[SERVIÇO] " : ""}${it.descricao}`;
      const lines = doc.splitTextToSize(desc, W - 2 * M - 60);
      doc.text(lines, M + 2, y);
      doc.text(String(it.quantidade), W - M - 50, y, { align: "right" });
      doc.text(formatCurrency(it.valor_unitario), W - M - 25, y, { align: "right" });
      doc.text(formatCurrency(it.valor_total), W - M - 2, y, { align: "right" });
      y += Math.max(5, lines.length * 4 + 1);
    }
  }

  // Totals
  y += 4;
  doc.setDrawColor(180);
  doc.line(W - M - 80, y, W - M, y);
  y += 5;
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("Subtotal:", W - M - 50, y); doc.text(formatCurrency(data.subtotal), W - M - 2, y, { align: "right" });
  y += 5;
  if (data.desconto > 0) {
    doc.text("Desconto:", W - M - 50, y);
    doc.text(`- ${formatCurrency(data.desconto)}`, W - M - 2, y, { align: "right" });
    y += 5;
  }
  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("TOTAL:", W - M - 50, y);
  doc.text(formatCurrency(data.total), W - M - 2, y, { align: "right" });
  y += 10;

  // Terms
  if (data.termos) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(8).setFont("helvetica", "bold");
    doc.text("TERMOS E CONDIÇÕES", M, y); y += 4;
    doc.setFont("helvetica", "normal");
    const tl = doc.splitTextToSize(data.termos, W - 2 * M);
    doc.text(tl, M, y);
  }

  return doc;
}

export async function shareOrcamentoViaWhatsApp(
  data: OrcamentoPDFData,
  telefone: string
): Promise<void> {
  const doc = generateOrcamentoPDF(data);
  const blob = doc.output("blob");
  const fileName = `orcamento-${data.numero || data.cliente.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });

  const message = `Olá *${data.cliente}*! 👋\n\nSegue o orçamento da *${data.empresa.nome}*:\n\n💰 *Total: ${formatCurrency(data.total)}*\n📅 Válido até: ${data.validade}\n\nQualquer dúvida, estamos à disposição!`;

  // Try Web Share API (mobile - sends actual PDF file)
  const navAny = navigator as any;
  if (navAny.canShare && navAny.canShare({ files: [file] })) {
    try {
      await navAny.share({ files: [file], title: "Orçamento", text: message });
      return;
    } catch (err: any) {
      if (err.name === "AbortError") return;
    }
  }

  // Fallback: download PDF + open WhatsApp with text
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const digits = telefone.replace(/\D/g, "");
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  const waMsg = message + `\n\n📎 O PDF foi baixado em seu dispositivo. Anexe-o nesta conversa.`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`, "_blank");
}
