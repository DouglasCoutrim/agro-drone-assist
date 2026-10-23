import { useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE, paginationRange } from '@/lib/pagination';
export function usePagination<T>(data: T[], resetKey?: unknown) {
 const [page, setPage] = useState(1);
 const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
 const range = paginationRange(data.length, page, pageSize);
 useEffect(() => { setPage(1); }, [resetKey, pageSize]);
 useEffect(() => { if (page !== range.currentPage) setPage(range.currentPage); }, [page, range.currentPage]);
 return { ...range, page: range.currentPage, pageSize, setPage, setPageSize, total: data.length, items: data.slice(range.offset, range.end) };
}
