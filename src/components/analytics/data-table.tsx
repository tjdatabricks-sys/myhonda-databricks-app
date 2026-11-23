"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "./chart-card";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  width?: string;
  cell?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  maxHeight?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, loading, maxHeight = "max-h-96", initialSort, rowKey, onRowClick, dense, emptyMessage }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const accessor = col.sortValue ?? ((r: T) => {
      const v = (r as Record<string, unknown>)[col.key];
      return typeof v === "number" ? v : String(v ?? "");
    });
    const sorted = [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sort.dir === "desc" ? sorted.reverse() : sorted;
  }, [rows, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  if (loading) {
    return (
      <div className="space-y-2 p-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className={cn("overflow-auto scrollbar-thin", maxHeight)}>
      <Table className={dense ? "text-xs" : "text-[13px]"}>
        <TableHeader className="sticky top-0 z-10 bg-white">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "whitespace-nowrap text-[11px] font-semibold tracking-wide text-slate-500 uppercase",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  !col.align && "text-left",
                  col.sortable !== false && "cursor-pointer select-none hover:text-slate-700"
                )}
                onClick={col.sortable === false ? undefined : () => toggleSort(col.key)}
              >
                <span className={cn("inline-flex items-center gap-1", col.align === "right" && "flex-row-reverse")}>
                  {col.header}
                  {col.sortable !== false ? (
                    sort?.key === col.key ? (
                      sort.dir === "desc" ? <ArrowDown className="h-3 w-3 text-teal-600" /> : <ArrowUp className="h-3 w-3 text-teal-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-300" />
                    )
                  ) : null}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row, i) => (
            <TableRow
              key={rowKey(row, i)}
              className={cn(onRowClick && "cursor-pointer", "hover:bg-slate-50/80")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "whitespace-nowrap py-2.5",
                    dense && "py-1.5",
                    col.align === "right" && "text-right tabular-nums",
                    col.align === "center" && "text-center",
                    !col.align && "text-left"
                  )}
                >
                  {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "-")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
