import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef(function Input(
  {
    className,
    type = "text",
    variant = "default",
    invalid = false,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    trailingElement,
    size = "md",
    ...props
  },
  ref
) {
  const sizeStyles = {
    sm: "h-8 text-xs px-2.5 rounded-lg",
    md: "h-10 text-sm px-3.5 rounded-xl",
    lg: "h-11 text-sm px-4 rounded-xl min-h-[44px]",
  }[size] || "h-10 text-sm px-3.5 rounded-xl";

  const variantStyles = {
    default: "bg-slate-50/50 dark:bg-[#111318] border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
    recessed: "bg-[var(--surface-muted)]/70 border-[var(--border-subtle)] focus:bg-white dark:focus:bg-[#111318]",
  }[variant] || "bg-slate-50/50 dark:bg-[#111318] border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100";

  return (
    <div className="relative flex items-center w-full">
      {LeadingIcon && (
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
          <LeadingIcon className="w-4 h-4" aria-hidden="true" />
        </div>
      )}
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid}
        className={cn(
          "w-full border text-sm transition-all duration-150 focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs",
          variantStyles,
          sizeStyles,
          LeadingIcon && "pl-10",
          (TrailingIcon || trailingElement) && "pr-10",
          invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      />
      {TrailingIcon && !trailingElement && (
        <div className="absolute right-3 flex items-center pointer-events-none text-[var(--text-muted)]">
          <TrailingIcon className="w-4 h-4" aria-hidden="true" />
        </div>
      )}
      {trailingElement && (
        <div className="absolute right-2.5 flex items-center">
          {trailingElement}
        </div>
      )}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, invalid = false, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid}
      className={cn(
        "w-full bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-[var(--radius-md)] p-3 text-sm transition-all focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed resize-y",
        invalid && "border-[var(--status-danger)] focus:border-[var(--status-danger)] focus:ring-[var(--status-danger)]",
        className
      )}
      {...props}
    />
  );
});
