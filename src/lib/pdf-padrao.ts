import { jsPDF } from "jspdf";
import { formatCurrency } from "./formatters";

/**
 * Padrão visual único dos PDFs do sistema (mesmo layout do orçamento consolidado):
 * logo + dados da empresa, título à direita, linha verde, quadro da parte, tabela paginada,
 * totais, textos, assinaturas e rodapé "Página X de Y".
 */
export interface EmpresaPDF { nome: string; telefone?: string | null; cnpj?: string | null; endereco?: string | null; logoDataUrl?: string }
export interface ColunaPDF { titulo: string; largura?: number; alinhar?: "left" | "right"; }
export interface DocumentoPadrao {
  titulo: string;
  numero?: string | number;
  linhasCabecalho?: string[]; // ex.: "Emissão: 01/01/2026"
  empresa: EmpresaPDF;
  parte?: { rotulo: string; nome: string; detalhes?: string[] };
  secoes?: { titulo: string; texto: string }[];
  tabela?: { titulo?: string; colunas: ColunaPDF[]; linhas: string[][]; vazio?: string };
  totais?: { rotulo: string; valor: number; destaque?: boolean; negativo?: boolean }[];
  observacao?: string;
  termos?: string;
  assinaturas?: [string, string];
  rodape?: string;
}

const W = 210, H = 297, M = 15, TOP = 18, BOTTOM = H - 18, LINE = 4.2;
export const PDF_GREEN: [number, number, number] = [11, 122, 85];

export async function loadImageAsDataUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch { return undefined; }
}

export function gerarDocumentoPadrao(d: DocumentoPadrao): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;
  const newPage = () => { doc.addPage(); y = TOP; };
  const ensure = (h: number) => { if (y + h > BOTTOM) { newPage(); return true; } return false; };
  const split = (t: string, w: number, size: number) => { doc.setFontSize(size); return doc.splitTextToSize(t || "", w) as string[]; };

  // Cabeçalho
  let textX = M;
  if (d.empresa.logoDataUrl) {
    try {
      const p = doc.getImageProperties(d.empresa.logoDataUrl);
      const h = 16, w = Math.min(40, (p.width / p.height) * h);
      doc.addImage(d.empresa.logoDataUrl, M, y, w, h);
      textX = M + w + 4;
    } catch { /* logo inválida */ }
  }
  doc.setTextColor(30).setFont("helvetica", "bold").setFontSize(15).text(d.empresa.nome || "Empresa", textX, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(100);
  const info = [d.empresa.cnpj ? `CNPJ: ${d.empresa.cnpj}` : "", d.empresa.telefone ? `Tel: ${d.empresa.telefone}` : ""].filter(Boolean).join("  |  ");
  if (info) doc.text(info, textX, y + 10);
  if (d.empresa.endereco) doc.text(split(d.empresa.endereco, 95, 8.5).slice(0, 1), textX, y + 14);
  doc.setTextColor(30).setFont("helvetica", "bold").setFontSize(12).text(d.titulo.toUpperCase(), W - M, y + 5, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90);
  let hy = y + 10;
  if (d.numero !== undefined && d.numero !== "") { doc.text(`Nº ${d.numero}`, W - M, hy, { align: "right" }); hy += 4; }
  (d.linhasCabecalho || []).forEach((l) => { doc.text(l, W - M, hy, { align: "right" }); hy += 4; });
  y = Math.max(y + 20, hy + 1);
  doc.setDrawColor(...PDF_GREEN).setLineWidth(0.7).line(M, y, W - M, y);
  y += 6;

  // Parte (cliente/fornecedor/funcionário)
  if (d.parte) {
    const det = (d.parte.detalhes || []).filter(Boolean).join("  |  ");
    const detLines = det ? split(det, W - 2 * M - 6, 9) : [];
    const boxH = 11 + detLines.length * LINE;
    doc.setFillColor(245, 247, 245).rect(M, y - 4, W - 2 * M, boxH, "F");
    doc.setTextColor(...PDF_GREEN).setFont("helvetica", "bold").setFontSize(8).text(d.parte.rotulo.toUpperCase(), M + 3, y);
    doc.setTextColor(30).setFontSize(10.5).text(d.parte.nome || "-", M + 3, y + 5);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70);
    if (detLines.length) doc.text(detLines, M + 3, y + 9.5);
    y += boxH + 3;
  }

  const sectionTitle = (t: string) => {
    doc.setTextColor(...PDF_GREEN).setFont("helvetica", "bold").setFontSize(9).text(t.toUpperCase(), M, y);
    doc.setDrawColor(220).setLineWidth(0.2).line(M, y + 1.5, W - M, y + 1.5);
    y += 6;
  };

  for (const s of d.secoes || []) {
    if (!s.texto?.trim()) continue;
    const lines = split(s.texto, W - 2 * M, 9);
    ensure(10 + Math.min(lines.length, 4) * LINE);
    sectionTitle(s.titulo);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40);
    lines.forEach((l) => { ensure(LINE); doc.text(l, M, y); y += LINE; });
    y += 3;
  }

  // Tabela
  if (d.tabela) {
    const cols = d.tabela.colunas;
    const fixed = cols.reduce((s, c) => s + (c.largura || 0), 0);
    const flex = cols.filter((c) => !c.largura).length || 1;
    const widths = cols.map((c) => c.largura || (W - 2 * M - fixed) / flex);
    const xs: number[] = []; let acc = M;
    widths.forEach((w) => { xs.push(acc); acc += w; });
    const colX = (i: number) => (cols[i].alinhar === "right" ? xs[i] + widths[i] - 2 : xs[i] + 2);
    const header = () => {
      doc.setFillColor(243, 244, 246).rect(M, y - 4, W - 2 * M, 6, "F");
      doc.setTextColor(60).setFont("helvetica", "bold").setFontSize(8.5);
      cols.forEach((c, i) => doc.text(c.titulo, colX(i), y, { align: c.alinhar === "right" ? "right" : "left" }));
      y += 5.5;
    };
    ensure(20);
    if (d.tabela.titulo) sectionTitle(d.tabela.titulo);
    header();
    if (!d.tabela.linhas.length) { doc.setFont("helvetica", "normal").setTextColor(130).text(d.tabela.vazio || "Sem itens.", M + 2, y); y += 6; }
    for (const row of d.tabela.linhas) {
      const cells = row.map((v, i) => split(v ?? "", widths[i] - 4, 8.5));
      const h = Math.max(6, Math.max(...cells.map((c) => c.length)) * LINE + 1.8);
      if (y + h > BOTTOM) { newPage(); header(); }
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30);
      cells.forEach((c, i) => doc.text(c, colX(i), y, { align: cols[i].alinhar === "right" ? "right" : "left" }));
      doc.setDrawColor(235).setLineWidth(0.2).line(M, y + h - 4, W - M, y + h - 4);
      y += h;
    }
    y += 4;
  }

  // Totais + observação + termos + assinaturas mantidos juntos quando cabem
  const obsLines = d.observacao ? split(d.observacao, W - 2 * M - 6, 8.5) : [];
  const termLines = d.termos ? split(d.termos, W - 2 * M, 7.5) : [];
  const totH = (d.totais?.length || 0) * 6 + 8;
  const sigH = d.assinaturas ? 30 : 0;
  const blockH = totH + (obsLines.length ? obsLines.length * LINE + 10 : 0) + (termLines.length ? 8 + termLines.length * 3.4 : 0) + sigH;
  if (blockH <= BOTTOM - TOP) ensure(blockH); else ensure(totH + 20);

  if (d.totais?.length) {
    doc.setDrawColor(200).setLineWidth(0.3).line(W - M - 85, y, W - M, y); y += 6;
    for (const t of d.totais) {
      if (t.destaque) {
        doc.setFillColor(236, 253, 243).rect(W - M - 85, y - 5, 85, 8, "F");
        doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...PDF_GREEN);
      } else doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(30);
      doc.text(`${t.rotulo}:`, W - M - 34, y, { align: "right" });
      doc.text(`${t.negativo ? "- " : ""}${formatCurrency(t.valor)}`, W - M - 2, y, { align: "right" });
      y += t.destaque ? 10 : 5.5;
    }
  }
  if (obsLines.length) {
    doc.setTextColor(...PDF_GREEN).setFont("helvetica", "bold").setFontSize(8.5).text("OBSERVAÇÕES", M, y); y += 4.5;
    doc.setTextColor(50).setFont("helvetica", "normal").text(obsLines, M, y); y += obsLines.length * LINE + 5;
  }
  if (termLines.length) {
    doc.setTextColor(110).setFont("helvetica", "bold").setFontSize(7.5).text("TERMOS E CONDIÇÕES", M, y); y += 4;
    doc.setFont("helvetica", "normal");
    termLines.forEach((l, idx) => {
      const rem = termLines.length - idx;
      if (rem <= 3 ? y + rem * 3.4 + sigH > BOTTOM : y + 3.4 > BOTTOM) newPage();
      doc.setTextColor(110).setFontSize(7.5).text(l, M, y); y += 3.4;
    });
    y += 4;
  }
  if (d.assinaturas) {
    ensure(sigH); y += 16;
    doc.setDrawColor(80).setLineWidth(0.3);
    doc.line(M + 5, y, M + 75, y); doc.line(W - M - 75, y, W - M - 5, y);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(60);
    doc.text(d.assinaturas[0], M + 40, y + 4.5, { align: "center" });
    doc.text(d.assinaturas[1], W - M - 40, y + 4.5, { align: "center" });
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(225).setLineWidth(0.2).line(M, H - 12, W - M, H - 12);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(140);
    doc.text(d.rodape || `${d.empresa.nome || ""} · ${d.titulo}${d.numero ? ` Nº ${d.numero}` : ""}`, M, H - 8);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 8, { align: "right" });
  }
  return doc;
}
