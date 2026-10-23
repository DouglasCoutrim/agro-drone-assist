import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PAGE_SIZE, paginationRange } from './pagination';
describe('record pagination', () => {
 test('starts with ten records per page', () => { assert.equal(DEFAULT_PAGE_SIZE, 10); assert.equal(paginationRange(25, 1, DEFAULT_PAGE_SIZE).last, 10); });
 test('keeps the next page contiguous', () => { const range = paginationRange(25, 2, 10); assert.equal(range.offset,10); assert.equal(range.first,11); assert.equal(range.last,20); assert.equal(range.pageCount,3); });
 test('clamps after deletion or filtering', () => { const range = paginationRange(3, 5, 10); assert.equal(range.currentPage,1); assert.equal(range.last,3); });
 test('handles empty results', () => { const range = paginationRange(0, 1, 10); assert.equal(range.first,0); assert.equal(range.last,0); assert.equal(range.pageCount,1); });
});
