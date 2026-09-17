import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  className,
  type = "button",
  ...props
}) {
  const variantStyles = {
    primary: "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white border border-transparent font-medium shadow-xs",
    secondary: "bg-[var(--surface-raised)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-medium",
    danger: "bg-[var(--status-danger)] hover:opacity-90 text-white border border-transparent font-medium shadow-xs",
    ghost: "bg-transparent hover:bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent",
    outline: "bg-transparent hover:bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border)] font-medium",
  }[variant] || "bg-[var(--accent-primary)] text-white";

  const sizeStyles = {
    sm: "h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-md)]",
    md: "h-9 px-4 text-sm gap-2 rounded-[var(--radius-md)]",
    lg: "h-11 px-5 text-base gap-2.5 rounded-[var(--radius-lg)] min-h-[44px]", // 44px touch target for Rider
  }[size] || "h-9 px-4 text-sm gap-2";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] cursor-pointer",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : LeadingIcon ? (
        <LeadingIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span className="truncate">{children}</span>
      {!loading && TrailingIcon ? (
        <TrailingIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  loading = false,
  disabled = false,
  className,
  type = "button",
  ...props
}) {
  const sizeStyles = {
    sm: "w-8 h-8 text-xs p-1.5 rounded-[var(--radius-md)]",
    md: "w-9 h-9 text-sm p-2 rounded-[var(--radius-md)]",
    lg: "w-11 h-11 text-base p-2.5 rounded-[var(--radius-lg)] min-w-[44px] min-h-[44px]",
  }[size] || "w-9 h-9 p-2";

  const variantStyles = {
    primary: "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white border border-transparent",
    secondary: "bg-[var(--surface-raised)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]",
    danger: "bg-[var(--status-danger)] hover:opacity-90 text-white border border-transparent",
    ghost: "bg-transparent hover:bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent",
    outline: "bg-transparent hover:bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border)]",
  }[variant] || "bg-transparent text-[var(--text-secondary)]";

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.96] cursor-pointer",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="w-4 h-4" aria-hidden="true" />
      ) : null}
    </button>
  );
}
