import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validarClienteFiscal, validarProdutoFiscal } from "./fiscal-validation.ts";

const cliOk = { cpf_cnpj: "123.456.789-09", cep: "01001-000", endereco: "Rua A", numero: "10", bairro: "Centro", cidade: "SP", estado: "SP", codigo_municipio: "3550308", indicador_ie: 9 };

describe("cadastro fiscal", () => {
  test("aceita cliente completo", () => assert.deepEqual(validarClienteFiscal(cliOk), []));
  test("bloqueia cliente sem bairro", () => assert.ok(validarClienteFiscal({ ...cliOk, bairro: "" }).includes("Bairro")));
  test("bloqueia contribuinte sem IE", () => assert.equal(validarClienteFiscal({ ...cliOk, indicador_ie: 1 }).length, 1));
  test("bloqueia produto sem NCM", () => assert.ok(validarProdutoFiscal({ ncm: "", cfop: "5102", unidade: "UN", csosn: "102" }).includes("NCM com 8 dígitos")));
  test("aceita produto completo", () => assert.deepEqual(validarProdutoFiscal({ ncm: "8507.60.00", cfop: "5102", unidade: "UN", csosn: "102" }), []));
});
