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
        "card-elevated p-5 flex flex-col justify-between min-h-[110px] relative overflow-hidden group select-none",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider truncate">
          {title}
        </span>
        {Icon ? (
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105", selectedIconStyle)}>
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2 my-1">
        {loading ? (
          <div className="h-9 w-28 bg-[var(--surface-raised)] animate-pulse rounded-[var(--radius-md)]" />
        ) : (
          <div className="text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {value}
          </div>
        )}

        {trend && !loading ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
              trend.direction === "up" && "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/20",
              trend.direction === "down" && "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger)]/20",
              trend.direction === "neutral" && "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
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
        <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export const MetricCard = memo(MetricCardComponent);
