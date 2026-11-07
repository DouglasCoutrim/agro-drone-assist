import { jsPDF } from "jspdf";
import { formatCurrency } from "./formatters";
import { gerarDocumentoPadrao } from "./pdf-padrao";

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
    logoDataUrl?: string;
  };
  termos?: string;
}

export function generateOrcamentoPDF(data: OrcamentoPDFData): jsPDF {
  return gerarDocumentoPadrao({
    titulo: "Orçamento",
    numero: data.numero,
    linhasCabecalho: [`Emissão: ${new Date().toLocaleDateString("pt-BR")}   Validade: ${data.validade}`],
    empresa: data.empresa,
    parte: { rotulo: "Cliente", nome: data.cliente, detalhes: [data.cliente_telefone ? `Tel: ${data.cliente_telefone}` : ""] },
    secoes: [{ titulo: "Equipamento / objeto", texto: data.equipamento }, { titulo: "Descrição", texto: data.descricao }],
    tabela: {
      titulo: "Itens",
      colunas: [{ titulo: "Descrição" }, { titulo: "Qtd", largura: 16, alinhar: "right" }, { titulo: "Unit.", largura: 30, alinhar: "right" }, { titulo: "Total", largura: 30, alinhar: "right" }],
      linhas: data.itens.map((it) => [`${it.tipo === "servico" ? "[Serviço] " : ""}${it.descricao}`, String(it.quantidade), formatCurrency(it.valor_unitario), formatCurrency(it.valor_total)]),
      vazio: "Sem itens detalhados.",
    },
    totais: [{ rotulo: "Subtotal", valor: data.subtotal }, ...(data.desconto > 0 ? [{ rotulo: "Desconto", valor: data.desconto, negativo: true }] : []), { rotulo: "TOTAL", valor: data.total, destaque: true }],
    termos: data.termos,
    assinaturas: [data.empresa.nome || "Empresa", `${data.cliente} — De acordo`],
  });
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
