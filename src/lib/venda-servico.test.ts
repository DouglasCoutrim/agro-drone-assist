import { test } from "node:test";
import assert from "node:assert/strict";
import { podeEmitirNfe } from "./venda-servico";

test("venda com serviço e peça não pode emitir NF-e", () => {
  assert.equal(podeEmitirNfe([{ produto_id: "p1", ncm: "85076000" }, { produto_id: null, ncm: "00" }]), false);
});
test("venda só com peças pode emitir NF-e", () => {
  assert.equal(podeEmitirNfe([{ produto_id: "p1", ncm: "85076000" }]), true);
});
