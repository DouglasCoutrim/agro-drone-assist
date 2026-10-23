import { describe, it, expect } from "vitest";
import { validarClienteFiscal, validarProdutoFiscal } from "./fiscal-validation";

const cliOk = { cpf_cnpj: "123.456.789-09", cep: "01001-000", endereco: "Rua A", numero: "10", bairro: "Centro", cidade: "SP", estado: "SP", codigo_municipio: "3550308", indicador_ie: 9 };

describe("cadastro fiscal", () => {
  it("aceita cliente completo", () => expect(validarClienteFiscal(cliOk)).toEqual([]));
  it("bloqueia cliente sem bairro", () => expect(validarClienteFiscal({ ...cliOk, bairro: "" })).toContain("Bairro"));
  it("bloqueia contribuinte sem IE", () => expect(validarClienteFiscal({ ...cliOk, indicador_ie: 1 }).length).toBe(1));
  it("bloqueia produto sem NCM", () => expect(validarProdutoFiscal({ ncm: "", cfop: "5102", unidade: "UN", csosn: "102" })).toContain("NCM com 8 dígitos"));
  it("aceita produto completo", () => expect(validarProdutoFiscal({ ncm: "8507.60.00", cfop: "5102", unidade: "UN", csosn: "102" })).toEqual([]));
});
