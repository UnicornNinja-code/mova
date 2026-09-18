import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Select,
  SelectItem,
  Alert,
} from "@/components/primitives";
import {
  Shield,
  ShieldAlert,
  ArrowRight,
  User,
  Clock,
  FileText,
  Lock,
  Info,
} from "lucide-react";
import { formatRoleName, getRoleConfig } from "@/lib/formatters";

const ROLE_DESCRIPTIONS = {
  SUPERADMIN: {
    title: "Super Admin (Full Administration)",
    context: "Akses penuh manajemen sistem, pengguna, audit log, dan pengaturan platform.",
  },
  MANAGEMENT: {
    title: "Manager (Business & Analytics)",
    context: "Akses analitik bisnis, evaluasi performa, laporan DSS, dan pemantauan zona.",
  },
  SUPERVISOR: {
    title: "Supervisor (Operational Control)",
    context: "Akses kontrol operasional harian, live mapops, penugasan armada, dan tim rider.",
  },
  RIDER: {
    title: "Rider (Field Mobile Operations)",
    context: "Akses aplikasi mobile rider, check-in zona, pencatatan penjualan, dan telemetri LBS.",
  },
};

export function getTransitionRisk(oldRole, newRole) {
  if (!oldRole || !newRole || oldRole === newRole) {
    return {
      level: "NONE",
      label: "NO CHANGE",
      badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25",
    };
  }

  if (oldRole === "SUPERADMIN" || newRole === "SUPERADMIN") {
    return {
      level: "CRITICAL",
      label: "CRITICAL RISK",
      badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/25",
    };
  }

  if (oldRole === "MANAGEMENT" || newRole === "MANAGEMENT") {
    return {
      level: "HIGH",
      label: "HIGH RISK",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    };
  }

  return {
    level: "LOW",
    label: "LOW RISK",
    badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  };
}

export function RoleTransitionModal({
  isOpen,
  targetUser,
  onClose,
  onConfirm,
  loading = false,
}) {
  const [selectedNewRole, setSelectedNewRole] = useState("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (targetUser) {
      const fallbackRole =
        targetUser.role === "SUPERVISOR"
          ? "RIDER"
          : targetUser.role === "RIDER"
          ? "SUPERVISOR"
          : targetUser.role === "MANAGEMENT"
          ? "SUPERVISOR"
          : "MANAGEMENT";
      setSelectedNewRole(fallbackRole);
      setReason("");
      setLocalError(null);
    }
  }, [targetUser, isOpen]);

  if (!targetUser) return null;

  const currentRole = targetUser.role;
  const risk = getTransitionRisk(currentRole, selectedNewRole);
  const isReasonValid = reason.trim().length >= 5;

  const handleExecute = async (e) => {
    e.preventDefault();
    if (!isReasonValid) {
      setLocalError("Alasan perubahan peran wajib diisi minimal 5 karakter.");
      return;
    }
    if (selectedNewRole === currentRole) {
      setLocalError("Pilih peran baru yang berbeda dari peran saat ini.");
      return;
    }
    setLocalError(null);
    await onConfirm({
      targetUserId: targetUser.id,
      newRole: selectedNewRole,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-5 sm:p-6">
        {/* Modal Header */}
        <DialogHeader className="pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-[var(--text-primary)]">
                Role Transition Policy
              </DialogTitle>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Mutasi hak akses dan konteks operasional pengguna
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleExecute} className="space-y-4 pt-3 text-xs">
          {localError && (
            <Alert variant="danger" title="Validasi Transisi Gagal" className="text-xs py-2">
              {localError}
            </Alert>
          )}

          {/* Two-Column Grid Body */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Left Column: Context, Identity & Consequences */}
            <div className="space-y-3 flex flex-col justify-between">
              {/* User Identity & Transition Card */}
              <div className="p-3 bg-[var(--surface-raised)]/60 border border-[var(--border-subtle)] rounded-[var(--radius-md)] space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] uppercase font-mono font-semibold tracking-wider text-[var(--text-muted)] block">
                      Target Pengguna
                    </span>
                    <span className="font-semibold text-[var(--text-primary)] text-xs block truncate mt-0.5">
                      {targetUser.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono block truncate">
                      {targetUser.email}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)] text-[9px] font-mono font-semibold uppercase tracking-wider border shadow-2xs shrink-0 ${risk.badgeClass}`}
                  >
                    <Shield className="w-2.5 h-2.5" />
                    {risk.label}
                  </span>
                </div>

                {/* Transition Direction Indicator */}
                <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]/70">
                  <div className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border-subtle)] rounded px-2 py-1.5 flex items-center gap-1.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                      <User className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] uppercase font-semibold text-[var(--text-muted)] block leading-none">
                        Saat Ini
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] text-[11px] truncate block mt-0.5">
                        {formatRoleName(currentRole)}
                      </span>
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />

                  <div className="flex-1 min-w-0 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded px-2 py-1.5 flex items-center gap-1.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white">
                      <User className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[8px] uppercase font-semibold text-[var(--accent-primary)] block leading-none">
                        Baru
                      </span>
                      <span className="font-semibold text-[var(--accent-primary)] text-[11px] truncate block mt-0.5">
                        {formatRoleName(selectedNewRole)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Konsekuensi & Dampak Perubahan */}
              <div className="p-3 bg-[var(--surface-raised)]/30 border border-[var(--border-subtle)] rounded-[var(--radius-md)] space-y-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                    Konsekuensi Transisi
                  </span>
                </div>

                <div className="space-y-2 pt-0.5">
                  <div className="flex items-start gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] mt-0.5">
                      <User className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <span className="font-medium text-[10px] text-[var(--text-primary)] block leading-tight">
                        Pencabutan Sesi Seketika
                      </span>
                      <p className="text-[9px] text-[var(--text-muted)] leading-tight mt-0.5">
                        Sesi aktif ({targetUser.active_sessions_count || 1} sesi) dicabut paksa. Pengguna wajib login ulang.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <span className="font-medium text-[10px] text-[var(--text-primary)] block leading-tight">
                        Retensi Data Historis
                      </span>
                      <p className="text-[9px] text-[var(--text-muted)] leading-tight mt-0.5">
                        Seluruh histori transaksi, tugas, & log audit tetap utuh.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 mt-0.5">
                      <FileText className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <span className="font-medium text-[10px] text-[var(--text-primary)] block leading-tight">
                        Audit Trail Wajib
                      </span>
                      <p className="text-[9px] text-[var(--text-muted)] leading-tight mt-0.5">
                        Mutasi hak akses dicatat permanen di log audit sistem.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Input Controls */}
            <div className="space-y-3 flex flex-col justify-between">
              {/* Select Target Role */}
              <div className="space-y-1">
                <label htmlFor="role-select" className="font-medium text-[11px] text-[var(--text-secondary)] block">
                  Pilih Peran Baru <span className="text-red-500">*</span>
                </label>
                <Select
                  id="role-select"
                  value={selectedNewRole}
                  onValueChange={(val) => {
                    setSelectedNewRole(val);
                    setLocalError(null);
                  }}
                >
                  <SelectItem value="SUPERVISOR" disabled={currentRole === "SUPERVISOR"}>
                    Supervisor (Operational Control)
                  </SelectItem>
                  <SelectItem value="MANAGEMENT" disabled={currentRole === "MANAGEMENT"}>
                    Manager (Business & Analytics)
                  </SelectItem>
                  <SelectItem value="RIDER" disabled={currentRole === "RIDER"}>
                    Rider (Field Mobile Operations)
                  </SelectItem>
                  <SelectItem value="SUPERADMIN" disabled={currentRole === "SUPERADMIN"}>
                    Super Admin (Full Administration)
                  </SelectItem>
                </Select>

                {ROLE_DESCRIPTIONS[selectedNewRole] && (
                  <div className="flex items-start gap-1.5 pt-1 text-[10px] text-[var(--text-muted)] leading-relaxed bg-[var(--surface)] p-2 rounded border border-[var(--border-subtle)]">
                    <Info className="w-3 h-3 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                    <span>{ROLE_DESCRIPTIONS[selectedNewRole].context}</span>
                  </div>
                )}
              </div>

              {/* Mandatory Reason Textarea */}
              <div className="space-y-1 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <label htmlFor="transition-reason" className="font-medium text-[11px] text-[var(--text-secondary)]">
                    Alasan Perubahan Peran <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">
                    {reason.length} / 500
                  </span>
                </div>
                <textarea
                  id="transition-reason"
                  rows={4}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Rotasi penugasan operasional Q3 atau promosi jabatan staf."
                  className="w-full flex-1 min-h-[90px] bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-[var(--radius-md)] p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <DialogFooter className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs h-8 px-3"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={loading}
              disabled={!isReasonValid || selectedNewRole === currentRole}
              className="flex items-center gap-1.5 text-xs h-8 px-4 shadow-2xs"
            >
              <Lock className="w-3 h-3 shrink-0" />
              <span>Konfirmasi Transisi Peran</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RoleTransitionModal;
