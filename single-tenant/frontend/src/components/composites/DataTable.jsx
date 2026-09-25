import React, { memo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  Skeleton,
  EmptyState,
} from "@/components/primitives";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

function DataTableComponent({
  columns = [],
  data = [],
  loading = false,
  emptyTitle = "Data tidak ditemukan",
  emptyDescription = "Belum ada rekaman yang sesuai dengan kriteria filter saat ini.",
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onRowClick,
  selectedRowId,
  idKey = "id",
  sortBy = null,
  sortDirection = "asc",
  onSort,
  className,
}) {
  return (
    <div className={cn("flex flex-col w-full", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => {
              const colKey = col.accessor || col.id || col.key || idx;
              const isSortable = Boolean(col.sortable);
              const isSorted = sortBy === colKey || (col.accessor && sortBy === col.accessor);

              return (
                <TableHead
                  key={colKey}
                  className={cn(
                    col.headerClassName,
                    isSortable &&
                      "cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors"
                  )}
                  onClick={isSortable && onSort ? () => onSort(colKey) : undefined}
                >
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      col.headerClassName?.includes("text-right") ? "justify-end w-full" : "justify-start"
                    )}
                  >
                    <span>{col.header}</span>
                    {isSortable && (
                      <span className="inline-flex items-center text-slate-400 dark:text-slate-500">
                        {isSorted ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody className="content-visibility-auto">
          {loading ? (
            Array.from({ length: 5 }).map((_, rIdx) => (
              <TableRow key={`skeleton-${rIdx}`}>
                {columns.map((col, cIdx) => (
                  <TableCell key={`skeleton-cell-${cIdx}`}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rIdx) => {
              const rowId = row[idKey] || rIdx;
              const isSelected = selectedRowId !== undefined && selectedRowId === rowId;

              return (
                <TableRow
                  key={rowId}
                  selected={isSelected}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {columns.map((col, cIdx) => (
                    <TableCell key={`${rowId}-${col.key || cIdx}`} className={col.cellClassName}>
                      {col.render ? col.render(row, rIdx) : row[col.accessor || col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {!loading && totalPages > 1 ? (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}

export const DataTable = memo(DataTableComponent);
