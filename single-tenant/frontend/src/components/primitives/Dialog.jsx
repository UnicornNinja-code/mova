import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, children }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>{children}</DialogPrimitive.Root>;
}

export function DialogTrigger({ asChild = true, children, ...props }) {
  return <DialogPrimitive.Trigger asChild={asChild} {...props}>{children}</DialogPrimitive.Trigger>;
}

export function DialogContent({ title, description, children, maxWidth = "md", className, ...props }) {
  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth] || "max-w-md";

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs animate-in fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 rounded-[var(--radius-md)]",
          maxWidthClass,
          className
        )}
        {...props}
      >
        <div className="flex flex-col space-y-1.5 text-left">
          {title && (
            <DialogPrimitive.Title className="text-base font-semibold text-[var(--text-primary)] leading-none">
              {title}
            </DialogPrimitive.Title>
          )}
          {description && (
            <DialogPrimitive.Description className="text-xs text-[var(--text-secondary)]">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>

        {children}

        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-[var(--radius-sm)] opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-[var(--text-secondary)]">
          <X className="h-4 w-4" />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children, className }) {
  return (
    <div className={cn("flex flex-col space-y-1.5 text-left", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className, ...props }) {
  return (
    <DialogPrimitive.Title className={cn("text-base font-semibold text-[var(--text-primary)] leading-none", className)} {...props}>
      {children}
    </DialogPrimitive.Title>
  );
}

export function DialogDescription({ children, className, ...props }) {
  return (
    <DialogPrimitive.Description className={cn("text-xs text-[var(--text-secondary)]", className)} {...props}>
      {children}
    </DialogPrimitive.Description>
  );
}

export function DialogFooter({ children, className }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)]", className)}>
      {children}
    </div>
  );
}

