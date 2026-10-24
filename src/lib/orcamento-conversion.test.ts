import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canConvertOrcamento } from './orcamento-conversion';

test('a combined quote cannot create a duplicate OS', () => {
  assert.equal(canConvertOrcamento({ status: 'pendente', ordem_servico_id: null, itens: [{ ordem_servico_id: 'os-1', os_numero: 'OS-001' }, { ordem_servico_id: 'os-2', os_numero: 'OS-002' }] }), false);
});
test('an independent pending quote can convert into an OS', () => {
  assert.equal(canConvertOrcamento({ status: 'pendente', ordem_servico_id: null, itens: [{ descricao: 'Reparo' }] }), true);
});
test('an already linked quote cannot create another OS', () => {
  assert.equal(canConvertOrcamento({ status: 'pendente', ordem_servico_id: 'os-1', itens: [] }), false);
});