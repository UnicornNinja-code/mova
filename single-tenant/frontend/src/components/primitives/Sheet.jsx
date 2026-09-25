import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({ open, onOpenChange, children }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>{children}</DialogPrimitive.Root>;
}

export function SheetTrigger({ asChild = true, children, ...props }) {
  return <DialogPrimitive.Trigger asChild={asChild} {...props}>{children}</DialogPrimitive.Trigger>;
}

export function SheetContent({
  side = "right",
  title,
  subtitle,
  children,
  width = "md",
  className,
  ...props
}) {
  const widthStyles = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-full",
  }[width] || "max-w-md";

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col h-full bg-white dark:bg-[#111318] border-slate-200/80 dark:border-white/10 shadow-2xl transition ease-in-out duration-300",
          side === "right" && "top-0 right-0 border-l animate-in slide-in-from-right",
          side === "left" && "top-0 left-0 border-r animate-in slide-in-from-left",
          "w-full",
          widthStyles,
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#14161D]">
          <div>
            {title && (
              <DialogPrimitive.Title className="text-sm font-heading font-medium text-slate-900 dark:text-slate-100">
                {title}
              </DialogPrimitive.Title>
            )}
            {subtitle && (
              <DialogPrimitive.Description className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="rounded-lg p-1.5 opacity-70 transition-opacity hover:opacity-100 hover:bg-slate-200/60 dark:hover:bg-[#181B22] text-slate-500 dark:text-slate-400 cursor-pointer">
            <X className="h-4 w-4" />
            <span className="sr-only">Tutup Panel</span>
          </DialogPrimitive.Close>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetFooter({ children, className }) {
  return (
    <div className={cn("p-4 border-t border-slate-200/80 dark:border-white/5 bg-slate-50/70 dark:bg-[#14161D] flex items-center justify-end gap-2", className)}>
      {children}
    </div>
  );
}
