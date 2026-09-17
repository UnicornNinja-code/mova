import React, { Component } from "react";
import { AlertCircle, AlertTriangle, CheckCircle, Info, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export function Alert({ title, children, variant = "info", icon: CustomIcon, className, action }) {
  const iconMap = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    danger: AlertCircle,
  };

  const Icon = CustomIcon || iconMap[variant] || Info;

  const variantStyles = {
    info: "bg-[var(--status-info-bg)] border-[var(--status-info)]/30 text-[var(--text-primary)]",
    success: "bg-[var(--status-success-bg)] border-[var(--status-success)]/30 text-[var(--text-primary)]",
    warning: "bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30 text-[var(--text-primary)]",
    danger: "bg-[var(--status-danger-bg)] border-[var(--status-danger)]/30 text-[var(--text-primary)]",
  }[variant] || "bg-[var(--status-info-bg)]";

  const iconColors = {
    info: "text-[var(--status-info)]",
    success: "text-[var(--status-success)]",
    warning: "text-[var(--status-warning)]",
    danger: "text-[var(--status-danger)]",
  }[variant] || "text-[var(--status-info)]";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-3.5 border rounded-[var(--radius-sm)] text-sm",
        variantStyles,
        className
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", iconColors)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold text-sm mb-0.5">{title}</h5>}
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Spinner({ size = "md", label = "Memuat data...", className }) {
  const sizeStyles = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  }[size] || "w-6 h-6";

  return (
    <div role="status" className={cn("inline-flex items-center gap-2 text-[var(--text-secondary)]", className)}>
      <Loader2 className={cn("animate-spin text-[var(--accent-primary)]", sizeStyles)} aria-hidden="true" />
      {label && <span className="text-xs">{label}</span>}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)]",
        className
      )}
      {...props}
    />
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Tidak ada data",
  description = "Belum ada rekaman data yang tersedia untuk tampilan ini.",
  action,
  className,
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 px-4 text-center", className)}>
      <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] mb-3">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h4>
      <p className="text-xs text-[var(--text-secondary)] max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 bg-[var(--surface)] border border-[var(--status-danger)]/30 rounded-[var(--radius-sm)] text-center my-4">
          <AlertCircle className="w-8 h-8 text-[var(--status-danger)] mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            {this.props.title || "Gagal Memuat Komponen"}
          </h4>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mb-4">
            {this.state.error?.message || "Terjadi kesalahan render pada antarmuka ini."}
          </p>
          <Button variant="secondary" size="sm" onClick={this.handleReset} leadingIcon={RefreshCw}>
            Coba Lagi
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
