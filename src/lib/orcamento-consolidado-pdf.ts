import { jsPDF } from "jspdf";
import { formatCurrency } from "./formatters";

export interface ConsolidadoItem {
  tipo: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export interface ConsolidadoGrupo {
  os_numero: string;
  equipamento: string;
  defeito?: string;
  diagnostico?: string;
  itens: ConsolidadoItem[];
}

export interface ConsolidadoPDFData {
  numero?: string;
  data: string;
  validade: string;
  cliente: { nome: string; telefone?: string };
  empresa: { nome: string; telefone?: string; cnpj?: string; endereco?: string; logoDataUrl?: string };
  grupos: ConsolidadoGrupo[];
  desconto: number;
  observacao?: string;
  termos?: string;
}

/** Stored item shape inside orcamentos.itens for grouped budgets. */
export interface GroupedStoredItem extends ConsolidadoItem {
  ordem_servico_id: string;
  os_numero: string;
  os_equipamento: string;
  os_defeito?: string;
  os_diagnostico?: string;
}

export const isGroupedOrcamento = (itens: unknown): boolean =>
  Array.isArray(itens) && itens.length > 0 && itens.every((i: any) => i && typeof i.os_numero === "string");

export function groupsFromStoredItems(itens: GroupedStoredItem[]): ConsolidadoGrupo[] {
  const map = new Map<string, ConsolidadoGrupo>();
  for (const i of itens) {
    const key = i.ordem_servico_id || i.os_numero;
    if (!map.has(key)) {
      map.set(key, { os_numero: i.os_numero, equipamento: i.os_equipamento, defeito: i.os_defeito, diagnostico: i.os_diagnostico, itens: [] });
    }
    map.get(key)!.itens.push({ tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade, valor_unitario: i.valor_unitario, valor_total: i.valor_total });
  }
  return [...map.values()];
}

export const grupoSubtotal = (g: ConsolidadoGrupo) => g.itens.reduce((s, i) => s + (Number(i.valor_total) || 0), 0);

export async function loadImageAsDataUrl(url?: string): Promise<string | undefined> {
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
  } catch {
    return undefined;
  }
}

// Layout constants (mm)
const W = 210;
const H = 297;
const M = 15;
const BOTTOM = H - 18; // reserve footer
const TOP = 18;
const COL_QTD = W - M - 62;
const COL_UNIT = W - M - 32;
const COL_TOTAL = W - M - 2;
const DESC_W = COL_QTD - M - 14;
const LINE = 4.2;
const GREEN: [number, number, number] = [22, 163, 74];

export function generateOrcamentoConsolidadoPDF(data: ConsolidadoPDFData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;

  const newPage = () => { doc.addPage(); y = TOP; };
  const ensure = (h: number) => { if (y + h > BOTTOM) { newPage(); return true; } return false; };
  const split = (t: string, w: number, size: number) => { doc.setFontSize(size); return doc.splitTextToSize(t || "", w) as string[]; };

  // ---------- Header ----------
  let textX = M;
  if (data.empresa.logoDataUrl) {
    try {
      const props = doc.getImageProperties(data.empresa.logoDataUrl);
      const h = 16;
      const w = Math.min(40, (props.width / props.height) * h);
      doc.addImage(data.empresa.logoDataUrl, M, y, w, h);
      textX = M + w + 4;
    } catch { /* ignore bad logo */ }
  }
  doc.setTextColor(30).setFont("helvetica", "bold").setFontSize(15);
  doc.text(data.empresa.nome || "Empresa", textX, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(100);
  const info = [data.empresa.cnpj ? `CNPJ: ${data.empresa.cnpj}` : "", data.empresa.telefone ? `Tel: ${data.empresa.telefone}` : ""].filter(Boolean).join("  |  ");
  if (info) doc.text(info, textX, y + 10);
  if (data.empresa.endereco) doc.text(split(data.empresa.endereco, 95, 8.5).slice(0, 1), textX, y + 14);

  doc.setTextColor(30).setFont("helvetica", "bold").setFontSize(12);
  doc.text("ORÇAMENTO CONSOLIDADO", W - M, y + 5, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90);
  if (data.numero) doc.text(`Nº ${data.numero}`, W - M, y + 10, { align: "right" });
  doc.text(`Emissão: ${data.data}   Validade: ${data.validade}`, W - M, y + 14, { align: "right" });
  y += 20;
  doc.setDrawColor(...GREEN).setLineWidth(0.7).line(M, y, W - M, y);
  y += 6;

  // ---------- Cliente ----------
  doc.setFillColor(245, 247, 245).rect(M, y - 4, W - 2 * M, 11, "F");
  doc.setTextColor(...GREEN).setFont("helvetica", "bold").setFontSize(8);
  doc.text("CLIENTE", M + 3, y);
  doc.setTextColor(30).setFontSize(10.5);
  doc.text(data.cliente.nome, M + 3, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(9);
  if (data.cliente.telefone) doc.text(`Tel: ${data.cliente.telefone}`, W - M - 3, y + 5, { align: "right" });
  y += 13;

  // ---------- Resumo ----------
  const sectionTitle = (t: string) => {
    doc.setTextColor(...GREEN).setFont("helvetica", "bold").setFontSize(9);
    doc.text(t.toUpperCase(), M, y);
    doc.setDrawColor(220).setLineWidth(0.2).line(M, y + 1.5, W - M, y + 1.5);
    y += 6;
  };
  const resumoH = 6 + 7 + data.grupos.length * 6 + 4;
  ensure(Math.min(resumoH, 60));
  sectionTitle(`Resumo — ${data.grupos.length} ordem(ns) de serviço`);
  doc.setFillColor(243, 244, 246).rect(M, y - 4, W - 2 * M, 6, "F");
  doc.setTextColor(60).setFont("helvetica", "bold").setFontSize(8.5);
  doc.text("OS", M + 2, y); doc.text("Equipamento", M + 30, y); doc.text("Valor", COL_TOTAL, y, { align: "right" });
  y += 5.5;
  doc.setFont("helvetica", "normal").setTextColor(30);
  for (const g of data.grupos) {
    if (ensure(6)) {
      doc.setFillColor(243, 244, 246).rect(M, y - 4, W - 2 * M, 6, "F");
      doc.setFont("helvetica", "bold").setTextColor(60).text("OS", M + 2, y); doc.text("Equipamento", M + 30, y); doc.text("Valor", COL_TOTAL, y, { align: "right" });
      doc.setFont("helvetica", "normal").setTextColor(30); y += 5.5;
    }
    doc.setFontSize(8.5);
    doc.text(g.os_numero, M + 2, y);
    doc.text(split(g.equipamento, COL_TOTAL - M - 60, 8.5)[0] || "", M + 30, y);
    doc.text(formatCurrency(grupoSubtotal(g)), COL_TOTAL, y, { align: "right" });
    doc.setDrawColor(235).line(M, y + 1.8, W - M, y + 1.8);
    y += 6;
  }
  y += 4;

  // ---------- Blocos por OS ----------
  const tableHeader = () => {
    doc.setFillColor(243, 244, 246).rect(M, y - 4, W - 2 * M, 6, "F");
    doc.setTextColor(60).setFont("helvetica", "bold").setFontSize(8.5);
    doc.text("Descrição", M + 2, y);
    doc.text("Qtd", COL_QTD, y, { align: "right" });
    doc.text("Unit.", COL_UNIT, y, { align: "right" });
    doc.text("Total", COL_TOTAL, y, { align: "right" });
    y += 5.5;
  };
  const rowLines = (i: ConsolidadoItem) => split(`${i.tipo === "servico" ? "[Serviço] " : ""}${i.descricao || "Item"}`, DESC_W, 8.5);
  const rowH = (i: ConsolidadoItem) => Math.max(6, rowLines(i).length * LINE + 1.8);

  for (const g of data.grupos) {
    const defLines = g.defeito ? split(`Defeito relatado: ${g.defeito}`, W - 2 * M - 4, 8.5) : [];
    const diaLines = g.diagnostico ? split(`Diagnóstico: ${g.diagnostico}`, W - 2 * M - 4, 8.5) : [];
    const headH = 9 + (defLines.length + diaLines.length) * LINE + 2;
    const rowsH = g.itens.length ? g.itens.reduce((s, i) => s + rowH(i), 0) : 6;
    const fullH = headH + 6 + rowsH + 8 + 4;

    // keep block together when it fits on a page; otherwise ensure head + first rows stay together
    if (y + fullH > BOTTOM) {
      const fitsFresh = fullH <= BOTTOM - TOP;
      const minStart = headH + 6 + (g.itens[0] ? rowH(g.itens[0]) : 6) * Math.min(3, Math.max(1, g.itens.length));
      if (fitsFresh || y + minStart > BOTTOM) newPage();
    }

    // block title
    doc.setFillColor(...GREEN).rect(M, y - 4.5, W - 2 * M, 7, "F");
    doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(9.5);
    doc.text(g.os_numero, M + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(split(g.equipamento, W - 2 * M - 70, 9.5)[0] || "", M + 28, y);
    doc.setFont("helvetica", "bold").text(formatCurrency(grupoSubtotal(g)), COL_TOTAL, y, { align: "right" });
    y += 6;
    doc.setTextColor(60).setFont("helvetica", "normal").setFontSize(8.5);
    if (defLines.length) { doc.text(defLines, M + 2, y); y += defLines.length * LINE; }
    if (diaLines.length) { doc.text(diaLines, M + 2, y); y += diaLines.length * LINE; }
    y += 3;

    tableHeader();
    doc.setFont("helvetica", "normal").setTextColor(30);
    if (!g.itens.length) {
      doc.setTextColor(130).text("Sem itens detalhados.", M + 2, y); y += 6;
    }
    for (const it of g.itens) {
      const h = rowH(it);
      if (y + h > BOTTOM) {
        newPage();
        doc.setTextColor(...GREEN).setFont("helvetica", "bold").setFontSize(9);
        doc.text(`${g.os_numero} (continuação)`, M, y); y += 6;
        tableHeader();
      }
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30);
      doc.text(rowLines(it), M + 2, y);
      doc.text(String(it.quantidade), COL_QTD, y, { align: "right" });
      doc.text(formatCurrency(it.valor_unitario), COL_UNIT, y, { align: "right" });
      doc.text(formatCurrency(it.valor_total), COL_TOTAL, y, { align: "right" });
      doc.setDrawColor(235).setLineWidth(0.2).line(M, y + h - 4, W - M, y + h - 4);
      y += h;
    }
    ensure(8);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(30);
    doc.text(`Subtotal ${g.os_numero}:`, COL_UNIT, y, { align: "right" });
    doc.text(formatCurrency(grupoSubtotal(g)), COL_TOTAL, y, { align: "right" });
    y += 10;
  }

  // ---------- Totais + observação + assinaturas (bloco único) ----------
  const subtotal = data.grupos.reduce((s, g) => s + grupoSubtotal(g), 0);
  const total = Math.max(0, subtotal - (data.desconto || 0));
  const obsLines = data.observacao ? split(data.observacao, W - 2 * M - 6, 8.5) : [];
  const termLines = data.termos ? split(data.termos, W - 2 * M, 7.5) : [];
  const termsH = termLines.length ? 8 + termLines.length * 3.4 : 0;
  const totalsH = 26 + (obsLines.length ? obsLines.length * LINE + 10 : 0);
  const sigH = 30;
  // Keep totals + terms + signatures together when they fit on a page; otherwise totals stay with terms start.
  if (totalsH + termsH + sigH <= BOTTOM - TOP) ensure(totalsH + termsH + sigH);
  else ensure(totalsH + 20);

  doc.setDrawColor(200).setLineWidth(0.3).line(W - M - 85, y, W - M, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(30);
  doc.text("Subtotal geral:", COL_UNIT, y, { align: "right" }); doc.text(formatCurrency(subtotal), COL_TOTAL, y, { align: "right" });
  y += 5.5;
  if (data.desconto > 0) {
    doc.text("Desconto:", COL_UNIT, y, { align: "right" }); doc.text(`- ${formatCurrency(data.desconto)}`, COL_TOTAL, y, { align: "right" });
    y += 5.5;
  }
  doc.setFillColor(236, 253, 243).rect(W - M - 85, y - 5, 85, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...GREEN);
  doc.text("TOTAL:", COL_UNIT, y, { align: "right" }); doc.text(formatCurrency(total), COL_TOTAL, y, { align: "right" });
  y += 10;

  if (obsLines.length) {
    doc.setTextColor(...GREEN).setFont("helvetica", "bold").setFontSize(8.5).text("OBSERVAÇÕES", M, y); y += 4.5;
    doc.setTextColor(50).setFont("helvetica", "normal").text(obsLines, M, y); y += obsLines.length * LINE + 5;
  }

  if (termLines.length) {
    doc.setTextColor(110).setFont("helvetica", "bold").setFontSize(7.5).text("TERMOS E CONDIÇÕES", M, y); y += 4;
    doc.setFont("helvetica", "normal");
    termLines.forEach((l, idx) => {
      // keep the signatures together with the last terms lines
      const remaining = termLines.length - idx;
      if (remaining <= 3 ? y + remaining * 3.4 + sigH > BOTTOM : y + 3.4 > BOTTOM) newPage();
      doc.setTextColor(110).setFontSize(7.5).text(l, M, y); y += 3.4;
    });
    y += 4;
  }

  ensure(sigH);
  y += 16;
  doc.setDrawColor(80).setLineWidth(0.3);
  doc.line(M + 5, y, M + 75, y); doc.line(W - M - 75, y, W - M - 5, y);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(60);
  doc.text(data.empresa.nome || "Empresa", M + 40, y + 4.5, { align: "center" });
  doc.text(`${data.cliente.nome} — De acordo`, W - M - 40, y + 4.5, { align: "center" });

  // ---------- Rodapé numerado ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(225).setLineWidth(0.2).line(M, H - 12, W - M, H - 12);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(140);
    doc.text(`${data.empresa.nome || ""} · Orçamento consolidado${data.numero ? ` Nº ${data.numero}` : ""}`, M, H - 8);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 8, { align: "right" });
  }
  return doc;
}

export async function shareConsolidadoPDF(doc: jsPDF, fileName: string, message: string, telefone?: string) {
  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: "Orçamento", text: message }); return; }
    catch (e: any) { if (e?.name === "AbortError") return; }
  }
  doc.save(fileName);
  if (telefone) {
    const digits = telefone.replace(/\D/g, "");
    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message + "\n\n📎 O PDF foi baixado em seu dispositivo. Anexe-o nesta conversa.")}`, "_blank");
  }
}
