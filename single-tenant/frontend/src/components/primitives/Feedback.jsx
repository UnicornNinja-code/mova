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
    info: "bg-sky-500/10 border-sky-500/20 text-slate-800 dark:text-slate-100",
    success: "bg-emerald-500/10 border-emerald-500/20 text-slate-800 dark:text-slate-100",
    warning: "bg-amber-500/10 border-amber-500/20 text-slate-800 dark:text-slate-100",
    danger: "bg-red-500/10 border-red-500/20 text-slate-800 dark:text-slate-100",
  }[variant] || "bg-sky-500/10 border-sky-500/20 text-slate-800 dark:text-slate-100";

  const iconColors = {
    info: "text-sky-500 dark:text-sky-400",
    success: "text-emerald-500 dark:text-emerald-400",
    warning: "text-amber-500 dark:text-amber-400",
    danger: "text-red-500 dark:text-red-400",
  }[variant] || "text-sky-500 dark:text-sky-400";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-3.5 border rounded-xl text-sm transition-colors",
        variantStyles,
        className
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", iconColors)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-heading font-medium text-sm mb-0.5 text-slate-900 dark:text-white">{title}</h5>}
        <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{children}</div>
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
    <div role="status" className={cn("inline-flex items-center gap-2 text-slate-500 dark:text-slate-400", className)}>
      <Loader2 className={cn("animate-spin text-[var(--brand-primary)]", sizeStyles)} aria-hidden="true" />
      {label && <span className="text-xs">{label}</span>}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-100 dark:bg-[#181B22] border border-slate-200/80 dark:border-white/5 rounded-xl",
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
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#181B22] border border-slate-200/80 dark:border-white/5 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <h4 className="text-sm font-heading font-medium text-slate-900 dark:text-white mb-1">{title}</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">{description}</p>
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
