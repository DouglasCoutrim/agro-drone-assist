/** Leitura de XML de NF-e (modelo 55) para importação de compras. */
export interface NfeParte {
  cpf_cnpj: string; nome: string; nome_fantasia: string; inscricao_estadual: string;
  telefone: string; endereco: string; numero: string; complemento: string; bairro: string;
  cidade: string; estado: string; cep: string;
}
export interface NfeProduto {
  codigo: string; gtin: string; descricao: string; ncm: string; cest: string; cfop: string;
  unidade: string; quantidade: number; custo_unitario: number;
}
export interface NfeImport {
  numero: string; serie: string; chave: string; emitente: NfeParte; transportadora: NfeParte | null; produtos: NfeProduto[];
}

const digits = (s: string) => (s || "").replace(/\D/g, "");
function txt(el: Element | null | undefined, tag: string): string {
  if (!el) return "";
  const n = el.getElementsByTagName(tag)[0];
  return n?.textContent?.trim() ?? "";
}
function parte(el: Element, enderTag: string): NfeParte {
  const end = el.getElementsByTagName(enderTag)[0] || el;
  return {
    cpf_cnpj: digits(txt(el, "CNPJ") || txt(el, "CPF")),
    nome: txt(el, "xNome"), nome_fantasia: txt(el, "xFant"), inscricao_estadual: txt(el, "IE"),
    telefone: txt(end, "fone"), endereco: txt(end, "xLgr") || txt(el, "xEnder"), numero: txt(end, "nro"),
    complemento: txt(end, "xCpl"), bairro: txt(end, "xBairro"), cidade: txt(end, "xMun"),
    estado: txt(end, "UF"), cep: digits(txt(end, "CEP")),
  };
}

export function parseNfeXml(xml: string): NfeImport {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Arquivo XML inválido.");
  const inf = doc.getElementsByTagName("infNFe")[0];
  if (!inf) throw new Error("O arquivo não é um XML de NF-e.");
  const ide = inf.getElementsByTagName("ide")[0];
  const emit = inf.getElementsByTagName("emit")[0];
  if (!emit) throw new Error("Emitente não encontrado no XML.");
  const transporta = inf.getElementsByTagName("transporta")[0];
  const transp = transporta ? parte(transporta, "__none__") : null;
  const produtos = Array.from(inf.getElementsByTagName("det")).map((det) => {
    const p = det.getElementsByTagName("prod")[0];
    const gtin = txt(p, "cEAN");
    return {
      codigo: txt(p, "cProd"), gtin: /^\d{8,14}$/.test(gtin) ? gtin : "", descricao: txt(p, "xProd"),
      ncm: digits(txt(p, "NCM")), cest: digits(txt(p, "CEST")), cfop: txt(p, "CFOP"),
      unidade: (txt(p, "uCom") || "UN").toUpperCase().slice(0, 6),
      quantidade: Number(txt(p, "qCom")) || 0, custo_unitario: Number(txt(p, "vUnCom")) || 0,
    };
  });
  return {
    numero: txt(ide, "nNF"), serie: txt(ide, "serie"), chave: (inf.getAttribute("Id") || "").replace(/^NFe/, ""),
    emitente: parte(emit, "enderEmit"),
    transportadora: transp && (transp.cpf_cnpj || transp.nome) ? transp : null,
    produtos,
  };
}
