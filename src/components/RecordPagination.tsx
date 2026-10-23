import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { paginationRange } from '@/lib/pagination';
export interface RecordPaginationProps { total: number; page: number; pageSize: number; setPage: (page: number) => void; setPageSize: (size: number) => void }
export function RecordPagination({ total, page, pageSize, setPage, setPageSize }: RecordPaginationProps) {
 const { first, last, pageCount, currentPage } = paginationRange(total, page, pageSize);
 return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground" aria-label="Paginação de registros">
  <span>{first}–{last} de {total} registros</span>
  <div className="flex flex-wrap items-center gap-3">
   <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}><SelectTrigger aria-label="Registros por página" className="h-8 w-[100px]"><SelectValue /></SelectTrigger><SelectContent>{[10,20,50].map(size => <SelectItem key={size} value={String(size)}>{size} / página</SelectItem>)}</SelectContent></Select>
   <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Primeira página" title="Primeira página" disabled={currentPage === 1} onClick={() => setPage(1)}><ChevronsLeft /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Página anterior" title="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}><ChevronLeft /></Button>
    <span className="min-w-16 text-center tabular-nums">{currentPage} / {pageCount}</span>
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Próxima página" title="Próxima página" disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}><ChevronRight /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Última página" title="Última página" disabled={currentPage === pageCount} onClick={() => setPage(pageCount)}><ChevronsRight /></Button>
   </div>
  </div>
 </div>;
}
