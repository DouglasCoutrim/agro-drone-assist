import { supabase } from "@/integrations/supabase/client";
import { gerarDocumentoPadrao, loadImageAsDataUrl } from "@/lib/pdf-padrao";
import { formatCurrency, formatDate, todayDateInput } from "@/lib/formatters";

export interface ReciboOSData {
  osId: string;
  osNumero: string;
  clienteNome: string;
  clienteTelefone?: string | null;
  clienteCpfCnpj?: string | null;
  valor: number;
  formaPagamento: string;
  dataPagamento?: string;
  observacoes?: string;
  organizationId: string;
}

const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

/**
 * Gera o PDF do Recibo de Recebimento de uma OS.
 * Busca os itens da OS e os dados da empresa no banco.
 */
export async function gerarReciboRecebimentoOS(data: ReciboOSData): Promise<jsPDF> {
  const { data: empresa } = await supabase
    .from("empresa_config")
    .select("nome_empresa, cnpj, telefone, endereco, logo_url")
    .eq("organization_id", data.organizationId)
    .maybeSingle();

  const { data: itens } = await supabase
    .from("itens_os")
    .select("descricao, tipo, quantidade, valor_unitario, valor_total")
    .eq("ordem_servico_id", data.osId)
    .order("created_at", { ascending: true });

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("tipo_equipamento, marca, modelo_equipamento, numero_serie, descricao_problema, data_entrada")
    .eq("id", data.osId)
    .maybeSingle();

  const equipamento = [
    os?.tipo_equipamento,
    os?.marca,
    os?.modelo_equipamento,
    os?.numero_serie ? `S/N ${os.numero_serie}` : "",
  ].filter(Boolean).join(" · ");

  const formaLabel = FORMA_LABEL[data.formaPagamento] || data.formaPagamento;
  const dataPagamento = data.dataPagamento ? formatDate(data.dataPagamento) : formatDate(todayDateInput());

  const linhasTabela = (itens || []).map((i: any) => [
    i.descricao || "-",
    i.tipo === "servico" ? "Serviço" : "Peça",
    String(i.quantidade || 1),
    formatCurrency(Number(i.valor_unitario) || 0),
    formatCurrency(Number(i.valor_total) || 0),
  ]);

  const doc = gerarDocumentoPadrao({
    titulo: "Recibo de Recebimento",
    numero: data.osNumero.replace(/^OS-?\s*/i, ""),
    linhasCabecalho: [
      `Emissão: ${new Date().toLocaleString("pt-BR")}`,
      `Data do pagamento: ${dataPagamento}`,
      "Documento sem valor fiscal",
    ],
    empresa: {
      nome: empresa?.nome_empresa || "Empresa",
      cnpj: empresa?.cnpj,
      telefone: empresa?.telefone,
      endereco: empresa?.endereco,
      logoDataUrl: await loadImageAsDataUrl(empresa?.logo_url),
    },
    parte: {
      rotulo: "Cliente",
      nome: data.clienteNome,
      detalhes: [
        data.clienteTelefone ? `Telefone: ${data.clienteTelefone}` : "",
        data.clienteCpfCnpj ? `CPF/CNPJ: ${data.clienteCpfCnpj}` : "",
      ].filter(Boolean),
    },
    secoes: equipamento ? [{ titulo: "Equipamento", texto: equipamento }] : undefined,
    tabela: linhasTabela.length > 0 ? {
      titulo: "Itens da OS",
      colunas: [
        { titulo: "Descrição" },
        { titulo: "Tipo", largura: 20 },
        { titulo: "Qtd", largura: 14, alinhar: "right" },
        { titulo: "Unit.", largura: 26, alinhar: "right" },
        { titulo: "Total", largura: 28, alinhar: "right" },
      ],
      linhas: linhasTabela,
    } : undefined,
    totais: [
      { rotulo: "Valor recebido", valor: data.valor, destaque: true },
    ],
    observacao: [
      `Forma de pagamento: ${formaLabel}`,
      data.observacoes || "",
    ].filter(Boolean).join(" | "),
    assinaturas: [empresa?.nome_empresa || "Empresa", data.clienteNome],
  });

  return doc;
}

/**
 * Gera e baixa o PDF do Recibo de Recebimento de uma OS.
 */
export async function baixarReciboRecebimentoOS(data: ReciboOSData): Promise<void> {
  const doc = await gerarReciboRecebimentoOS(data);
  const nomeArquivo = `recibo-os-${data.osNumero.replace(/^OS-?\s*/i, "")}.pdf`;
  doc.save(nomeArquivo);
}