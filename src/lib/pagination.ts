export const DEFAULT_PAGE_SIZE = 10;
export function paginationRange(total: number, page: number, pageSize: number) {
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const offset = (currentPage - 1) * size;
  return { pageCount, currentPage, offset, end: offset + size, first: total ? offset + 1 : 0, last: Math.min(total, offset + size) };
}
