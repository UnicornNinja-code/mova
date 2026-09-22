import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Badge,
  Button,
} from "@/components/primitives";
import {
  MapPin,
  Calendar,
  Clock,
  Database,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Globe,
  User,
  UploadCloud,
} from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { PoiCategoryBadge } from "./PoiCategoryIcon";

export function PoiDetailModal({
  isOpen,
  onClose,
  poi,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  canManage,
}) {
  const [copied, setCopied] = useState(false);

  if (!poi) return null;

  const handleCopyCoordinates = () => {
    const coords = `${poi.latitude}, ${poi.longitude}`;
    navigator.clipboard.writeText(coords);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSourceDisplay = (sourceVal) => {
    if (sourceVal === "OVERPASS_API" || poi.external_id?.startsWith("osm:")) {
      return {
        label: "OpenStreetMap (Overpass)",
        icon: Globe,
        badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
      };
    }
    if (sourceVal === "MANUAL_ENTRY" || poi.external_id?.startsWith("manual:")) {
      return {
        label: "Manual Input",
        icon: User,
        badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
      };
    }
    if (sourceVal === "MANUAL_BULK_UPLOAD") {
      return {
        label: "Bulk Upload",
        icon: UploadCloud,
        badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25",
      };
    }
    return {
      label: "Sistem",
      icon: Database,
      badgeClass: "bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
    };
  };

  const sourceInfo = getSourceDisplay(poi.metadata?.source);
  const SourceIcon = sourceInfo.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] shadow-xl p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Detail Titik POI
            </span>
            <Badge
              variant={
                poi.operational_status === "ELIGIBLE" && poi.status === "APPROVED"
                  ? "success"
                  : poi.status === "PENDING"
                  ? "warning"
                  : "neutral"
              }
            >
              {poi.operational_status === "ELIGIBLE" && poi.status === "APPROVED"
                ? "Aktif & Eligible"
                : poi.status === "PENDING"
                ? "Menunggu Review"
                : poi.operational_status || poi.status}
            </Badge>
          </div>

          <DialogTitle className="text-lg font-bold text-[var(--text-primary)] leading-snug">
            {poi.name}
          </DialogTitle>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <PoiCategoryBadge category={poi.category} />
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium border ${sourceInfo.badgeClass}`}
            >
              <SourceIcon className="w-3.5 h-3.5" />
              <span>{sourceInfo.label}</span>
            </span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Coordinate Box */}
          <div className="bg-[var(--surface-raised)] rounded-[var(--radius-md)] p-4 border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <MapPin className="w-4 h-4 text-[var(--accent-primary)]" />
                Koordinat Geografis (WGS84)
              </span>
              <button
                onClick={handleCopyCoordinates}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] shadow-2xs cursor-pointer"
                title="Salin Koordinat"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm font-mono">
              <div className="bg-[var(--surface)] p-2.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">Latitude</span>
                <span className="text-[var(--text-primary)] font-semibold">{poi.latitude}</span>
              </div>
              <div className="bg-[var(--surface)] p-2.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider">Longitude</span>
                <span className="text-[var(--text-primary)] font-semibold">{poi.longitude}</span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${poi.latitude},${poi.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 w-full text-xs text-[var(--accent-primary)] hover:underline py-2 bg-[var(--surface)] rounded-[var(--radius-sm)] border border-[var(--border)] transition-all font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Buka Titik Lokasi di Google Maps
            </a>
          </div>

          {/* Operational Metadata */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Metadata & Riwayat
            </h3>
            <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden bg-[var(--surface-raised)]/40 text-xs">
              <div className="flex justify-between items-center p-3">
                <span className="text-[var(--text-secondary)] flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Sumber Asal
                </span>
                <span className="text-[var(--text-primary)] font-medium">
                  {sourceInfo.label}
                </span>
              </div>

              <div className="flex justify-between items-center p-3">
                <span className="text-[var(--text-secondary)] flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Status Persetujuan
                </span>
                <Badge
                  variant={
                    poi.approval_status === "APPROVED"
                      ? "success"
                      : poi.approval_status === "REJECTED"
                      ? "danger"
                      : "warning"
                  }
                >
                  {poi.approval_status || "APPROVED"}
                </Badge>
              </div>

              <div className="flex justify-between items-center p-3">
                <span className="text-[var(--text-secondary)] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Terakhir Diperbarui
                </span>
                <span className="text-[var(--text-secondary)] font-mono">
                  {formatDate(poi.updated_at || poi.created_at)}
                </span>
              </div>

              {poi.exclusion_reason && (
                <div className="flex justify-between items-center p-3 bg-red-500/10">
                  <span className="text-red-700 dark:text-red-400 font-medium">Alasan Pengecualian</span>
                  <span className="text-red-800 dark:text-red-300 font-mono font-semibold">
                    {poi.exclusion_reason}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--surface-raised)]/60 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {canManage && poi.status === "PENDING" && (
              <>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => onApprove(poi)}
                  className="gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onReject(poi)}
                  className="gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  Tolak
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {canManage && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onEdit(poi)}
                  className="gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(poi)}
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
