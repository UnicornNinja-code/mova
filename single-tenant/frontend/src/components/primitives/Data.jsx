import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./Button";

export function Table({ children, className, ...props }) {
  return (
    <div className="w-full overflow-x-auto border border-[var(--border-subtle)] rounded-[var(--radius-lg)] bg-[var(--surface)]">
      <table className={cn("w-full text-left text-xs border-collapse", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className, ...props }) {
  return (
    <thead className={cn("bg-[var(--surface-raised)]/60 border-b border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase tracking-wider font-semibold text-[10px]", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className, ...props }) {
  return (
    <tbody className={cn("divide-y divide-[var(--border-subtle)] bg-[var(--surface)]", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, selected = false, className, ...props }) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-[var(--surface-raised)]/50",
        selected && "bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/15",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className, ...props }) {
  return (
    <th scope="col" className={cn("px-4 py-3 font-semibold text-[var(--text-secondary)] select-none", className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className, ...props }) {
  return (
    <td className={cn("px-4 py-3 text-[var(--text-primary)] align-middle", className)} {...props}>
      {children}
    </td>
  );
}

export function Tabs({ defaultValue, value, onValueChange, children, className }) {
  return (
    <TabsPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} className={cn("w-full flex flex-col", className)}>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabsList({ children, className }) {
  return (
    <TabsPrimitive.List className={cn("inline-flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 p-1 rounded-[var(--radius-md)] w-full", className)}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ value, children, icon: Icon, disabled = false, className }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--accent-primary)] data-[state=active]:shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        className
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, children, className }) {
  return (
    <TabsPrimitive.Content value={value} className={cn("pt-4 focus-visible:outline-none", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}

export function Pagination({ currentPage, totalPages, onPageChange, className }) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface)] text-xs text-[var(--text-secondary)] select-none", className)}>
      <span>
        Halaman <strong className="font-semibold text-[var(--text-primary)]">{currentPage}</strong> dari <strong className="font-semibold text-[var(--text-primary)]">{totalPages}</strong>
      </span>
      <div className="flex items-center gap-1">
        <IconButton
          icon={ChevronsLeft}
          label="Halaman Pertama"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
        />
        <IconButton
          icon={ChevronLeft}
          label="Halaman Sebelumnya"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        />
        <IconButton
          icon={ChevronRight}
          label="Halaman Berikutnya"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        />
        <IconButton
          icon={ChevronsRight}
          label="Halaman Terakhir"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        />
      </div>
    </div>
  );
}
