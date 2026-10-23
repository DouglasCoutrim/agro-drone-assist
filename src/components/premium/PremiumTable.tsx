import { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/usePagination';
import { RecordPagination, RecordPaginationProps } from '@/components/RecordPagination';
interface Column { key: string; label: string; width?: string; align?: 'left' | 'center' | 'right' }
interface PremiumTableProps {
 columns: Column[]; data: any[]; renderCell: (item: any, columnKey: string) => ReactNode;
 onRowClick?: (item: any) => void; loading?: boolean; emptyMessage?: string; emptyIcon?: ReactNode;
 emptyAction?: { label: string; onClick: () => void }; rowKey?: (item: any) => string;
 striped?: boolean; hoverable?: boolean; animateRows?: boolean;
 pagination?: false | RecordPaginationProps;
}
export function PremiumTable({ columns, data, renderCell, onRowClick, loading = false, emptyMessage = 'Nenhum registro encontrado', emptyIcon, emptyAction, rowKey = item => item.id || JSON.stringify(item), striped = false, hoverable = true, pagination }: PremiumTableProps) {
 const local = usePagination(data);
 const rows = pagination === false || pagination ? data : local.items;
 const controls = pagination === false ? null : pagination || local;
 const alignment = (col: Column) => cn(col.align === 'center' && 'text-center', col.align === 'right' && 'text-right');
 return <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
  {loading ? <div className="space-y-3 p-4" role="status" aria-label="Carregando registros">{Array.from({length: 5}, (_, i) => <div key={i} className="h-9 animate-pulse rounded bg-muted" />)}</div> : !data.length ?
   <div className="flex flex-col items-center justify-center gap-3 py-12 text-center"><div className="text-muted-foreground">{emptyIcon}</div><p className="font-medium">{emptyMessage}</p>{emptyAction && <Button onClick={emptyAction.onClick}>{emptyAction.label}</Button>}</div> : <>
    <div className="hidden md:block overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/50">{columns.map(col => <TableHead key={col.key} className={cn('px-4 py-3 text-xs font-medium text-muted-foreground', col.width, alignment(col))}>{col.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((item, idx) => <TableRow key={rowKey(item)} onClick={() => onRowClick?.(item)} className={cn('border-border', hoverable && 'hover:bg-muted/40', onRowClick && 'cursor-pointer', striped && idx % 2 === 0 && 'bg-muted/20')}>{columns.map(col => <TableCell key={col.key} className={cn('px-4 py-3 text-sm',col.width,alignment(col))}>{renderCell(item,col.key)}</TableCell>)}</TableRow>)}</TableBody></Table></div>
    <div className="divide-y divide-border md:hidden">{rows.map(item => <div key={rowKey(item)} className="space-y-2 p-4" onClick={() => onRowClick?.(item)}>{columns.map(col => <div key={col.key} className="flex min-w-0 items-center justify-between gap-3">{col.label && <span className="shrink-0 text-xs text-muted-foreground">{col.label}</span>}<div className="min-w-0 break-words text-sm">{renderCell(item,col.key)}</div></div>)}</div>)}</div>
   </>}
  {!loading && controls && <RecordPagination {...controls} />}
 </div>;
}
