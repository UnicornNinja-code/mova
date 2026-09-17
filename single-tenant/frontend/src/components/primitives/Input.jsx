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
    size = "md",
    ...props
  },
  ref
) {
  const sizeStyles = {
    sm: "h-8 text-xs px-2.5",
    md: "h-9 text-sm px-3",
    lg: "h-11 text-base px-4 min-h-[44px]",
  }[size] || "h-9 text-sm px-3";

  const variantStyles = {
    default: "bg-[var(--surface-raised)] border-[var(--border)]",
    recessed: "bg-[var(--surface-muted)]/70 border-[var(--border-subtle)] focus:bg-[var(--surface-raised)]",
  }[variant] || "bg-[var(--surface-raised)] border-[var(--border)]";

  return (
    <div className="relative flex items-center w-full">
      {LeadingIcon && (
        <div className="absolute left-3 flex items-center pointer-events-none text-[var(--text-muted)]">
          <LeadingIcon className="w-4 h-4" aria-hidden="true" />
        </div>
      )}
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid}
        className={cn(
          "w-full border text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-[var(--radius-md)] transition-all duration-150 focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles,
          LeadingIcon && "pl-9",
          TrailingIcon && "pr-9",
          invalid && "border-[var(--status-danger)] focus:border-[var(--status-danger)] focus:ring-[var(--status-danger)]",
          sizeStyles,
          className
        )}
        {...props}
      />
      {TrailingIcon && (
        <div className="absolute right-3 flex items-center pointer-events-none text-[var(--text-muted)]">
          <TrailingIcon className="w-4 h-4" aria-hidden="true" />
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
