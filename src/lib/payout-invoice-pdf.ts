import type { jsPDF } from "jspdf";
import { gerarDocumentoPadrao, loadImageAsDataUrl, type EmpresaPDF } from "./pdf-padrao";
import { formatCurrency, formatDate } from "./formatters";

/** Empresa como a tela conhece (`logo_url`), convertida para data URL dentro do PDF. */
export type EmpresaFatura = Omit<EmpresaPDF, "logoDataUrl"> & { logo_url?: string | null };

export interface PayoutInvoicePDFItem {
  description: string;
  reference_date?: string | null;
  amount: number;
  kind?: string | null;
  snapshot?: Record<string, unknown> | null;
}

export interface PayoutInvoicePDFData {
  numero: string;
  status: string;
  period_start?: string | null;
  period_end?: string | null;
  total: number;
  pix_key?: string | null;
  pix_key_type?: string | null;
  notes?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  rejected_reason?: string | null;
}

export interface PayoutInvoiceTecnico {
  nome: string;
  telefone?: string | null;
  documento?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  paga: "Paga",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

const numeroOuTraco = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) && n !== 0 ? formatCurrency(n) : "—";
};

/** Fatura de saque do técnico, no padrão visual único do sistema (`gerarDocumentoPadrao`). */
export async function gerarFaturaSaquePDF({
  invoice,
  items,
  empresa,
  tecnico,
}: {
  invoice: PayoutInvoicePDFData;
  items: PayoutInvoicePDFItem[];
  empresa: EmpresaFatura & { nome: string };
  tecnico: PayoutInvoiceTecnico;
}): Promise<jsPDF> {
  const periodo = [invoice.period_start, invoice.period_end].filter(Boolean);
  const linhasCabecalho = [
    `Emissão: ${new Date().toLocaleString("pt-BR")}`,
    `Status: ${STATUS_LABEL[invoice.status] ?? invoice.status}`,
    periodo.length ? `Período: ${periodo.map((d) => formatDate(d as string)).join(" a ")}` : "",
  ].filter(Boolean);

  return gerarDocumentoPadrao({
    titulo: "Fatura de Saque",
    numero: invoice.numero,
    linhasCabecalho,
    empresa: { ...empresa, logoDataUrl: await loadImageAsDataUrl(empresa.logo_url) },
    parte: {
      rotulo: "Técnico",
      nome: tecnico.nome,
      detalhes: [
        tecnico.telefone ? `Telefone: ${tecnico.telefone}` : "",
        tecnico.documento ? `Documento: ${tecnico.documento}` : "",
        invoice.pix_key ? `PIX (${invoice.pix_key_type || "chave"}): ${invoice.pix_key}` : "PIX não informado",
      ],
    },
    tabela: {
      titulo: "Ordens de serviço",
      colunas: [
        { titulo: "Descrição" },
        { titulo: "Data", largura: 24, alinhar: "right" },
        { titulo: "Valor da OS", largura: 28, alinhar: "right" },
        { titulo: "Imposto", largura: 24, alinhar: "right" },
        { titulo: "Custo", largura: 24, alinhar: "right" },
        { titulo: "Comissão", largura: 28, alinhar: "right" },
      ],
      linhas: items.map((i) => {
        const s = (i.snapshot || {}) as Record<string, unknown>;
        return [
          i.description,
          i.reference_date ? formatDate(i.reference_date) : "—",
          i.kind === "ajuste" ? "—" : numeroOuTraco(s.valor_os),
          i.kind === "ajuste" ? "—" : numeroOuTraco(s.imposto),
          i.kind === "ajuste" ? "—" : numeroOuTraco(s.custo),
          formatCurrency(Number(i.amount) || 0),
        ];
      }),
      vazio: "Nenhuma OS nesta fatura.",
      ajustarLargura: true,
    },
    totais: [{ rotulo: "TOTAL A RECEBER", valor: Number(invoice.total) || 0, destaque: true }],
    observacao: [
      invoice.notes ? `Observação: ${invoice.notes}` : "",
      invoice.rejected_reason ? `Recusada: ${invoice.rejected_reason}` : "",
      invoice.paid_at ? `Paga em ${formatDate(invoice.paid_at)}` : "",
      invoice.pix_key ? `Pagamento via PIX para a chave ${invoice.pix_key}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    termos:
      "Esta fatura refere-se às comissões de ordens de serviço concluídas e já pagas pelo cliente, apuradas pela regra vigente: valor cobrado da OS menos imposto da nota e custo do serviço repassado, divididos 50% entre empresa e técnico. Documento sem valor fiscal.",
    assinaturas: [empresa.nome || "Empresa", tecnico.nome],
    rodape: `${empresa.nome || ""} · Fatura de saque Nº ${invoice.numero}`,
  });
}

/** Compartilha o PDF (Web Share no celular; download + WhatsApp no computador). */
export async function compartilharFaturaSaquePDF(
  doc: jsPDF,
  fileName: string,
  message: string,
  telefone?: string | null,
) {
  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Fatura de saque", text: message });
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }
  doc.save(fileName);
  if (telefone) {
    const digits = telefone.replace(/\D/g, "");
    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message + "\n\n📎 O PDF foi baixado em seu dispositivo. Anexe-o nesta conversa.")}`,
      "_blank",
    );
  }
}
