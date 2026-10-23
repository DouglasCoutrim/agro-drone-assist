import { describe, test, expect } from 'bun:test';
import { DEFAULT_PAGE_SIZE, paginationRange } from './pagination';
describe('record pagination', () => {
 test('starts with ten records per page', () => { expect(DEFAULT_PAGE_SIZE).toBe(10); expect(paginationRange(25, 1, DEFAULT_PAGE_SIZE).last).toBe(10); });
 test('keeps the next page contiguous', () => { expect(paginationRange(25, 2, 10)).toMatchObject({offset: 10, first: 11, last: 20, pageCount: 3}); });
 test('clamps after deletion or filtering', () => { expect(paginationRange(3, 5, 10)).toMatchObject({currentPage: 1, first: 1, last: 3}); });
 test('handles empty results', () => { expect(paginationRange(0, 1, 10)).toMatchObject({first: 0, last: 0, pageCount: 1}); });
});
