import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function MetricCardComponent({
  title,
  value,
  subtitle,
  icon: Icon,
  trend, // { value: "+12%", direction: "up" | "down" | "neutral" }
  status, // "success" | "warning" | "danger" | "info" | "brand"
  loading = false,
  className,
}) {
  const iconVariantMap = {
    success: "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/20",
    warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/20",
    danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/20",
    info: "bg-[var(--status-info-bg)] text-[var(--status-info)] border-[var(--status-info)]/20",
    brand: "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--accent-primary)]/25",
    neutral: "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  };

  const selectedIconStyle = iconVariantMap[status] || iconVariantMap.brand;

  return (
    <div
      className={cn(
        "bg-white dark:bg-[#111318] border border-slate-200/80 dark:border-white/5 rounded-xl p-5 shadow-xs flex flex-col justify-between min-h-[110px] relative overflow-hidden select-none",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-heading font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
          {title}
        </span>
        {Icon ? (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors", selectedIconStyle)}>
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2 my-1">
        {loading ? (
          <div className="h-9 w-28 bg-slate-100 dark:bg-[#181B22] animate-pulse rounded-xl" />
        ) : (
          <div className="text-2xl lg:text-3xl font-heading font-medium tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </div>
        )}

        {trend && !loading ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
              trend.direction === "up" && "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/20",
              trend.direction === "down" && "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/20",
              trend.direction === "neutral" && "bg-slate-100 dark:bg-[#181B22] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5"
            )}
          >
            {trend.direction === "up" ? <TrendingUp className="w-3 h-3" /> : null}
            {trend.direction === "down" ? <TrendingDown className="w-3 h-3" /> : null}
            {trend.direction === "neutral" ? <Minus className="w-3 h-3" /> : null}
            <span>{trend.value}</span>
          </div>
        ) : null}
      </div>

      {subtitle ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export const MetricCard = memo(MetricCardComponent);
