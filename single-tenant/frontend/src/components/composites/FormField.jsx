import React from "react";
import { cn } from "@/lib/utils";

export function FormField({ children, className }) {
  return <div className={cn("flex flex-col gap-1.5 w-full", className)}>{children}</div>;
}

export function FormLabel({ children, required = false, htmlFor, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1", className)}
    >
      <span>{children}</span>
      {required && <span className="text-[var(--status-danger)]" aria-hidden="true">*</span>}
    </label>
  );
}

export function FormHelperText({ children, className }) {
  if (!children) return null;
  return <p className={cn("text-[11px] text-[var(--text-muted)]", className)}>{children}</p>;
}

export function FormErrorText({ children, className }) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("text-[11px] font-medium text-[var(--status-danger)] animate-in fade-in-50", className)}>
      {children}
    </p>
  );
}
