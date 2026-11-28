import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { moverItem, normalizarOrdem } from './painel-layout';

describe('ordem personalizada dos painéis', () => {
  test('move um bloco para a posição de destino', () => {
    assert.deepEqual(moverItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
    assert.deepEqual(moverItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
    assert.deepEqual(moverItem(['a', 'b', 'c'], 1, 2), ['a', 'c', 'b']);
  });

  test('não mexe na lista quando a posição é a mesma ou está fora do intervalo', () => {
    const lista = ['a', 'b', 'c'];
    assert.equal(moverItem(lista, 1, 1), lista);
    assert.equal(moverItem(lista, 0, 3), lista);
    assert.equal(moverItem(lista, -1, 0), lista);
    assert.deepEqual(moverItem([], 0, 1), []);
  });

  test('descarta ids que não existem mais e mantém os blocos novos no fim', () => {
    assert.deepEqual(normalizarOrdem(['c', 'a'], ['a', 'b', 'c']), ['c', 'a', 'b']);
    assert.deepEqual(normalizarOrdem(['antigo', 'b'], ['a', 'b']), ['b', 'a']);
  });

  test('ignora conteúdo inválido e ordem repetida', () => {
    assert.deepEqual(normalizarOrdem(null, ['a', 'b']), ['a', 'b']);
    assert.deepEqual(normalizarOrdem('a', ['a', 'b']), ['a', 'b']);
    assert.deepEqual(normalizarOrdem(['a', 'a', 'b'], ['a', 'b']), ['a', 'b']);
    assert.deepEqual(normalizarOrdem(undefined, []), []);
  });
});
