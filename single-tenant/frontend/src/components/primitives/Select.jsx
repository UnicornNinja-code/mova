import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ value, onValueChange, placeholder = "Pilih opsi...", disabled = false, invalid = false, children, className }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-invalid={invalid}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#111318] px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs transition-colors",
          invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 text-slate-400 opacity-70" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="relative z-50 min-w-[8rem] overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111318] text-slate-900 dark:text-slate-100 shadow-xl p-1.5 animate-in fade-in-80"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-0.5">
            {children}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function SelectItem({ value, children, disabled = false, className }) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none hover:bg-slate-100 dark:hover:bg-[#181B22] focus:bg-slate-100 dark:focus:bg-[#181B22] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors",
        className
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4 text-[var(--brand-primary)]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
