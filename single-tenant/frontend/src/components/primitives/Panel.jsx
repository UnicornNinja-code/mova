import React from "react";
import { cn } from "@/lib/utils";

export function Panel({ children, elevated = true, className, ...props }) {
  return (
    <div
      className={cn(
        "bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] text-[var(--text-primary)] overflow-hidden transition-all duration-200",
        elevated ? "shadow-[var(--shadow-card)] hover:border-[var(--border)]" : "shadow-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ title, subtitle, description, action, children, className, ...props }) {
  const sub = subtitle || description;
  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface)] flex items-center justify-between gap-3",
        className
      )}
      {...props}
    >
      {children || (
        <>
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)] truncate">{title}</h3>}
            {sub && <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{sub}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </>
      )}
    </div>
  );
}

export function PanelBody({ children, padding = "md", className, ...props }) {
  const padClass = {
    none: "p-0",
    sm: "p-3",
    md: "p-5",
    lg: "p-6",
  }[padding] || "p-5";

  return (
    <div className={cn(padClass, className)} {...props}>
      {children}
    </div>
  );
}

export const PanelContent = PanelBody;

export function PanelFooter({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]/50 flex items-center justify-between text-xs text-[var(--text-secondary)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Modern Bento Card Aliases
export const Card = Panel;
export function CardHeader({ className, children, ...props }) {
  return <div className={cn("p-5 pb-3 flex flex-col space-y-1.5", className)} {...props}>{children}</div>;
}
export function CardTitle({ className, children, ...props }) {
  return <h3 className={cn("text-sm font-semibold leading-none tracking-tight text-[var(--text-primary)]", className)} {...props}>{children}</h3>;
}
export function CardDescription({ className, children, ...props }) {
  return <p className={cn("text-xs text-[var(--text-secondary)] mt-1", className)} {...props}>{children}</p>;
}
export function CardContent({ className, children, ...props }) {
  return <div className={cn("p-5 pt-0", className)} {...props}>{children}</div>;
}
export function CardFooter({ className, children, ...props }) {
  return <div className={cn("p-5 pt-0 flex items-center", className)} {...props}>{children}</div>;
}
