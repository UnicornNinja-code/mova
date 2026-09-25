import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./Button";

export function Table({ children, className, ...props }) {
  return (
    <div className="w-full overflow-x-auto border border-slate-200/80 dark:border-white/5 rounded-xl bg-white dark:bg-[#111318] shadow-xs">
      <table className={cn("w-full text-left text-xs border-collapse", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className, ...props }) {
  return (
    <thead className={cn("bg-slate-50/80 dark:bg-[#14161D] border-b border-slate-200/80 dark:border-white/5 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-heading font-medium text-[11px]", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className, ...props }) {
  return (
    <tbody className={cn("divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-[#111318]", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, selected = false, className, ...props }) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150 hover:bg-slate-50/70 dark:hover:bg-[#181B22]/70",
        selected && "bg-[var(--brand-subtle)] hover:bg-[var(--brand-subtle)]",
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
    <th scope="col" className={cn("px-4 py-3 font-heading font-medium text-slate-700 dark:text-slate-200 select-none", className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className, ...props }) {
  return (
    <td className={cn("px-4 py-3.5 text-slate-800 dark:text-slate-200 align-middle", className)} {...props}>
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
    <TabsPrimitive.List className={cn("inline-flex items-center gap-1 border border-slate-200/80 dark:border-white/5 bg-slate-100/80 dark:bg-[#14161D] p-1 rounded-xl w-full", className)}>
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
        "inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-primary)] data-[state=active]:bg-white dark:data-[state=active]:bg-[#181B22] data-[state=active]:text-[var(--brand-primary)] data-[state=active]:font-semibold data-[state=active]:shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
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
    <div className={cn("flex items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#111318] text-xs text-slate-500 dark:text-slate-400 select-none rounded-b-xl", className)}>
      <span>
        Halaman <strong className="font-semibold text-slate-800 dark:text-slate-200">{currentPage}</strong> dari <strong className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</strong>
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
