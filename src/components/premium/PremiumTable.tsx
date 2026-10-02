import { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface Column {
  key: string;
  label: string;
  width?: string; // ex: "w-[100px]" ou "flex-1"
  align?: "left" | "center" | "right";
}

interface PremiumTableProps {
  columns: Column[];
  data: any[];
  renderCell: (item: any, columnKey: string) => ReactNode;
  onRowClick?: (item: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyAction?: { label: string; onClick: () => void }; // Action button for empty state
  rowKey?: (item: any) => string;
  striped?: boolean;
  hoverable?: boolean;
  animateRows?: boolean; // Enable staggered row animations
}

export function PremiumTable({
  columns,
  data,
  renderCell,
  onRowClick,
  loading = false,
  emptyMessage = "Nenhum registro encontrado",
  emptyIcon,
  emptyAction,
  rowKey = (item) => item.id || JSON.stringify(item),
  striped = false,
  hoverable = true,
  animateRows = true,
}: PremiumTableProps) {
  const [visibleRows, setVisibleRows] = useState<Set<number>>(new Set());

  // Trigger staggered row animations
  useEffect(() => {
    if (!animateRows) {
      setVisibleRows(new Set(data.map((_, i) => i)));
      return;
    }

    const timer = setTimeout(() => {
      data.forEach((_, i) => {
        setTimeout(() => {
          setVisibleRows((prev) => new Set([...prev, i]));
        }, i * 50); // 50ms stagger
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [data, animateRows]);

  // Loading skeleton state
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`${col.width || "flex-1"} px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider`}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="border-b border-gray-200">
                {columns.map((col) => (
                  <TableCell key={col.key} className={`${col.width || "flex-1"} px-4 py-3`}>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
            {emptyIcon || (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{emptyMessage}</h3>
          {emptyAction && (
            <button
              onClick={emptyAction.onClick}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors duration-200"
            >
              {emptyAction.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`${col.width || "flex-1"} px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider`}
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, idx) => {
            const isVisible = visibleRows.has(idx);
            return (
              <TableRow
                key={rowKey(item)}
                className={cn(
                  "border-b border-gray-200 transition-all duration-300",
                  hoverable && "hover:bg-gray-50 cursor-pointer",
                  striped && idx % 2 === 0 && "bg-gray-50/50",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
                onClick={() => onRowClick?.(item)}
                style={{ transitionDelay: `${idx * 50}ms` }}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      `${col.width || "flex-1"} px-4 py-3 text-sm text-gray-900`,
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right"
                    )}
                    style={{ textAlign: col.align }}
                  >
                    {renderCell(item, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}