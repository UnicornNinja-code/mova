import React from "react";
import { Button, Panel, StatusBadge } from "@/components/primitives";
import { Navigation, MapPin, CheckCircle2, AlertCircle, ShoppingBag, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function RiderAction({
  label,
  sublabel,
  icon: Icon = Navigation,
  onClick,
  variant = "primary",
  loading = false,
  disabled = false,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "w-full min-h-[56px] p-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] text-left transition-all active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white",
        variant === "success" && "bg-[var(--status-success)] text-white",
        variant === "danger" && "bg-[var(--status-danger)] text-white",
        variant === "secondary" && "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)]",
        className
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="p-2.5 rounded-full bg-white/20 shrink-0">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-base font-bold leading-tight">{label}</div>
          {sublabel && <div className="text-xs opacity-80 mt-0.5">{sublabel}</div>}
        </div>
      </div>
      <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/20 uppercase tracking-wider">
        Aksi
      </div>
    </button>
  );
}

export function AssignmentCard({
  zoneName = "Zona Belum Ditugaskan",
  hubCity = "Sidoarjo",
  armadaName = "Gerobak #01",
  shiftTime = "Sore (15:00 - 18:00)",
  status = "ACTIVE",
  className,
}) {
  return (
    <Panel className={cn("p-4 border-[var(--accent-primary)]/40 bg-[var(--surface)]", className)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
          <MapPin className="w-4 h-4" />
          <span>Penugasan Operasional</span>
        </div>
        <StatusBadge status={status} />
      </div>

      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{zoneName}</h2>
      <p className="text-xs text-[var(--text-secondary)] mb-4">{hubCity} Hub</p>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--border-subtle)] text-xs">
        <div>
          <span className="text-[var(--text-muted)] block text-[10px] uppercase">Armada</span>
          <span className="font-semibold text-[var(--text-primary)]">{armadaName}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)] block text-[10px] uppercase">Waktu Shift</span>
          <span className="font-semibold text-[var(--text-primary)]">{shiftTime}</span>
        </div>
      </div>
    </Panel>
  );
}

export function GpsStatusIndicator({
  isLive = true,
  complianceStatus = "COMPLIANT",
  accuracyMeters = 5,
  className,
}) {
  return (
    <div className={cn("flex items-center justify-between p-2.5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full", isLive ? "bg-[var(--status-success)] animate-pulse" : "bg-[var(--text-muted)]")} />
        <span className="font-semibold text-[var(--text-primary)]">
          {isLive ? "GPS Aktif" : "GPS Terputus"}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">
          (Akurasi: ±{accuracyMeters}m)
        </span>
      </div>
      <StatusBadge status={complianceStatus} />
    </div>
  );
}
