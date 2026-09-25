import React from "react";
import { cn } from "@/lib/utils";

export function Panel({ children, elevated = true, className, ...props }) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-200",
        elevated ? "shadow-xs hover:border-slate-300 dark:hover:border-white/10" : "shadow-none",
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
        "px-5 py-4 border-b border-slate-200/80 dark:border-white/5 bg-white dark:bg-[#111318] flex items-center justify-between gap-3",
        className
      )}
      {...props}
    >
      {children || (
        <>
          <div className="min-w-0">
            {title && <h3 className="text-sm font-heading font-medium tracking-tight text-slate-900 dark:text-white truncate">{title}</h3>}
            {sub && <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{sub}</p>}
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
        "px-5 py-3 border-t border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-[#14161D] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400",
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
  return <h3 className={cn("text-base font-heading font-medium leading-none tracking-tight text-slate-900 dark:text-white", className)} {...props}>{children}</h3>;
}
export function CardDescription({ className, children, ...props }) {
  return <p className={cn("text-xs text-slate-500 dark:text-slate-400 mt-1", className)} {...props}>{children}</p>;
}
export function CardContent({ className, children, ...props }) {
  return <div className={cn("p-5 pt-0", className)} {...props}>{children}</div>;
}
export function CardFooter({ className, children, ...props }) {
  return <div className={cn("p-5 pt-0 flex items-center", className)} {...props}>{children}</div>;
}
