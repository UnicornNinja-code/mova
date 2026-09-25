import React from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, variant = "neutral", size = "sm", pill = true, className, ...props }) {
  const variantStyles = {
    neutral: "bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-medium",
    success: "bg-[var(--status-success-bg)] text-[var(--status-success)] border border-[var(--status-success)]/20 font-medium",
    warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border border-[var(--status-warning)]/20 font-medium",
    danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border border-[var(--status-danger)]/20 font-medium",
    info: "bg-[var(--status-info-bg)] text-[var(--status-info)] border border-[var(--status-info)]/20 font-medium",
    brand: "bg-[var(--brand-subtle)] text-[var(--brand-primary)] border border-[var(--brand-primary)]/20 font-medium",
  }[variant] || "bg-[var(--surface-raised)] text-[var(--text-secondary)]";

  const sizeStyles = {
    xs: "text-[10px] px-2 py-0.5 leading-none",
    sm: "text-[11px] px-2.5 py-0.5 leading-tight",
    md: "text-xs px-3 py-1 leading-tight",
  }[size] || "text-[11px] px-2.5 py-0.5";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center tracking-normal transition-colors",
        pill ? "rounded-full" : "rounded-lg",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Maps operational business state to semantic status badge (Lampiran 1 Pill Style)
 */
export function StatusBadge({ status, label, size = "sm", pill = true, className }) {
  const statusStr = String(status || "").toUpperCase();

  const statusConfig = {
    // Rider Compliance & Status
    COMPLIANT: { variant: "success", text: "Compliant" },
    AVAILABLE: { variant: "success", text: "Available" },
    BUSY: { variant: "warning", text: "Busy" },
    OFFLINE: { variant: "neutral", text: "Offline" },
    DEVIATED: { variant: "warning", text: "Deviated" },
    OUTSIDE_ZONE: { variant: "danger", text: "Outside Zone" },
    PROHIBITED_ROAD_ALERT: { variant: "danger", text: "Prohibited Road" },

    // Operational Status
    ACTIVE: { variant: "success", text: "Active" },
    INACTIVE: { variant: "neutral", text: "Inactive" },
    RESTRICTED: { variant: "warning", text: "Restricted" },
    PENDING: { variant: "info", text: "Pending" },
    HOLD: { variant: "warning", text: "Held" },
    IN_USE: { variant: "brand", text: "In Use" },
    CHECKED_IN: { variant: "success", text: "Checked In" },
    CHECKED_OUT: { variant: "neutral", text: "Checked Out" },
    COMPLETED: { variant: "neutral", text: "Completed" },
    DELIVERED: { variant: "success", text: "Delivered" },
    CANCELLED: { variant: "danger", text: "Cancelled" },
    PAID: { variant: "success", text: "Paid" },
    COD: { variant: "info", text: "COD" },

    // DSS Data Quality & Provenance
    VALID: { variant: "success", text: "Valid" },
    FRESH: { variant: "success", text: "Fresh" },
    DEGRADED: { variant: "warning", text: "Degraded" },
    ERROR: { variant: "danger", text: "Error" },

    // Competitor Reconciliation State
    UNLINKED: { variant: "neutral", text: "Unlinked" },
    CANDIDATE_MATCH: { variant: "warning", text: "Candidate Match" },
    DEFINITIVE_MATCH: { variant: "brand", text: "Definitive Match" },
  }[statusStr] || { variant: "neutral", text: statusStr || "Unknown" };

  return (
    <Badge variant={statusConfig.variant} size={size} pill={pill} className={className}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80 shrink-0" />
      {label || statusConfig.text}
    </Badge>
  );
}
