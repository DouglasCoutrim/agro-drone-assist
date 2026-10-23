/** Campos exigidos pela NF-e. Mantém as mesmas regras da conferência feita na emissão. */
const d = (v?: string | null) => (v || "").replace(/\D/g, "");

export function validarClienteFiscal(c: {
  cpf_cnpj?: string; endereco?: string; numero?: string; bairro?: string; cidade?: string;
  estado?: string; cep?: string; codigo_municipio?: string; indicador_ie?: number; inscricao_estadual?: string;
}): string[] {
  const p: string[] = [];
  const doc = d(c.cpf_cnpj);
  if (![11, 14].includes(doc.length)) p.push("CPF/CNPJ válido");
  if (d(c.cep).length !== 8) p.push("CEP com 8 dígitos");
  if (!c.endereco?.trim()) p.push("Endereço (logradouro)");
  if (!c.numero?.trim()) p.push("Número (use S/N se não houver)");
  if (!c.bairro?.trim()) p.push("Bairro");
  if (!c.cidade?.trim()) p.push("Cidade");
  if (!c.estado?.trim()) p.push("Estado (UF)");
  if (d(c.codigo_municipio).length !== 7) p.push("Código IBGE do município (busque pelo CEP)");
  if (c.indicador_ie === 1 && !c.inscricao_estadual?.trim()) p.push("Inscrição estadual (cliente contribuinte)");
  return p;
}

export function validarProdutoFiscal(i: { ncm?: string | null; cfop?: string | null; unidade?: string | null; csosn?: string | null; cest?: string | null; gtin?: string | null }): string[] {
  const p: string[] = [];
  if (d(i.ncm).length !== 8) p.push("NCM com 8 dígitos");
  if (d(i.cfop).length !== 4) p.push("CFOP com 4 dígitos");
  if (!i.unidade?.trim()) p.push("Unidade");
  if (!d(i.csosn)) p.push("CSOSN");
  if (i.cest && d(i.cest).length !== 7) p.push("CEST com 7 dígitos (ou deixe vazio)");
  if (i.gtin && !/^(\d{8}|\d{12,14})$/.test(d(i.gtin))) p.push("Código de barras (GTIN) com 8, 12, 13 ou 14 dígitos (ou vazio)");
  return p;
}
