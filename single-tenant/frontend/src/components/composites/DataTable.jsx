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
  className,
}) {
  return (
    <div className={cn("flex flex-col w-full", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead key={col.key || idx} className={col.headerClassName}>
                {col.header}
              </TableHead>
            ))}
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
