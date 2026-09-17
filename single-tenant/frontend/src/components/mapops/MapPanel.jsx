import React from "react";
import { Sheet, SheetContent, Badge, StatusBadge, Button } from "@/components/primitives";
import { MapPin, User, Navigation, ShieldCheck, DollarSign, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function MapLegend({ className }) {
  const legendItems = [
    { label: "Zona Operasional", color: "#3B82F6", border: "solid" },
    { label: "Titik TOPSIS Ranked", color: "#3B82F6", border: "solid" },
    { label: "Rider Compliant (Dalam Zona)", color: "#10B981", border: "solid" },
    { label: "Rider Deviated (Keluar Geofence)", color: "#F59E0B", border: "solid" },
    { label: "Jalan Terlarang (Protokol/Tol)", color: "#EF4444", border: "dashed" },
    { label: "Titik Survei Kompetitor", color: "#8B5CF6", border: "solid" },
  ];

  return (
    <div className={cn("absolute bottom-6 left-4 z-10 bg-[var(--surface)]/95 backdrop-blur-xs border border-[var(--border)] p-2.5 rounded-[var(--radius-sm)] shadow-md text-[11px]", className)}>
      <div className="font-semibold text-[var(--text-primary)] mb-1.5 uppercase tracking-wider text-[10px]">
        Legenda Spasial MapOps
      </div>
      <div className="flex flex-col gap-1.5">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span
              className="w-3 h-1.5 shrink-0 rounded-xs"
              style={{
                backgroundColor: item.color,
                borderStyle: item.border,
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapPanel({
  open,
  onOpenChange,
  entityType,
  selectedEntity,
  onAction,
  width = "md",
}) {
  if (!selectedEntity) return null;

  const renderEntityContent = () => {
    switch (entityType) {
      case "zone":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-[var(--surface-muted)] rounded border border-[var(--border-subtle)]">
              <div>
                <span className="text-[var(--text-muted)]">Kode Zona</span>
                <p className="font-mono font-bold text-sm text-[var(--text-primary)]">{selectedEntity.code || selectedEntity.id}</p>
              </div>
              <StatusBadge status={selectedEntity.status || "ACTIVE"} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)]">
                <span className="text-[var(--text-muted)] block mb-1">Target Kuota Rider</span>
                <span className="font-mono font-semibold text-sm text-[var(--text-primary)]">
                  {selectedEntity.target_riders || selectedEntity.quota || "4"} Rider
                </span>
              </div>
              <div className="p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)]">
                <span className="text-[var(--text-muted)] block mb-1">Target Pendapatan</span>
                <span className="font-mono font-semibold text-sm text-[var(--status-success)]">
                  Rp {(selectedEntity.revenue_target || 500000).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <span className="font-semibold text-[var(--text-primary)]">Aksi Cepat Zona</span>
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center"
                onClick={() => onAction && onAction("dss-calculate", selectedEntity)}
              >
                Evaluasi DSS TOPSIS Zona Ini
              </Button>
            </div>
          </div>
        );

      case "rider":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-[var(--surface-muted)] rounded border border-[var(--border-subtle)]">
              <div>
                <span className="text-[var(--text-muted)]">Armada Ditugaskan</span>
                <p className="font-mono font-bold text-sm text-[var(--text-primary)]">{selectedEntity.armada_code || selectedEntity.armada_id || "-"}</p>
              </div>
              <StatusBadge status={selectedEntity.compliance_status || selectedEntity.status || "COMPLIANT"} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)]">
                <span className="text-[var(--text-muted)] block mb-1">Kecepatan GPS</span>
                <span className="font-mono font-semibold text-sm text-[var(--text-primary)]">
                  {selectedEntity.speed || 0} km/h
                </span>
              </div>
              <div className="p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)]">
                <span className="text-[var(--text-muted)] block mb-1">Penjualan Shift</span>
                <span className="font-mono font-semibold text-sm text-[var(--status-success)]">
                  {selectedEntity.sales_count || 0} cup
                </span>
              </div>
            </div>

            <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--surface)]">
              <span className="text-[var(--text-muted)] block mb-1">Koordinat GPS Terkini</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">
                Lat: {Number(selectedEntity.latitude || selectedEntity.lat || 0).toFixed(6)}, Lng: {Number(selectedEntity.longitude || selectedEntity.lng || 0).toFixed(6)}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                onClick={() => onAction && onAction("contact-rider", selectedEntity)}
              >
                Panggil / Kirim Instruksi Rider
              </Button>
            </div>
          </div>
        );

      case "spot":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 bg-[var(--surface-muted)] rounded border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Peringkat Kelayakan Jual</span>
              <p className="font-mono font-bold text-base text-[var(--accent-primary)]">Rank #{selectedEntity.rank || 1}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                Skor TOPSIS: <span className="font-mono font-bold">{Number(selectedEntity.topsis_score || 0).toFixed(4)}</span>
              </p>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center"
                onClick={() => onAction && onAction("plot-spot", selectedEntity)}
              >
                Plot Penugasan Rider ke Titik Ini
              </Button>
            </div>
          </div>
        );

      case "competitor":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 bg-[var(--surface-muted)] rounded border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Brand Kompetitor</span>
              <p className="font-bold text-base text-[var(--text-primary)]">{selectedEntity.brand_name}</p>
              <span className="text-[11px] text-[var(--text-secondary)]">Kategori: {selectedEntity.category || "Coffee Shop"}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)]">
              <span className="text-[var(--text-muted)]">Status Verifikasi</span>
              <StatusBadge status={selectedEntity.status || "CONFIRMED"} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const titles = {
    zone: `Zona: ${selectedEntity.name || selectedEntity.id}`,
    rider: `Rider: ${selectedEntity.rider_name || selectedEntity.name || selectedEntity.id}`,
    spot: `Titik Potensial: ${selectedEntity.name || "Kandidat Jual"}`,
    competitor: `Kompetitor: ${selectedEntity.brand_name || "Survey"}`,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={titles[entityType] || "Inspeksi Spasial"}
        subtitle="Rincian Telemetri & Parameter Geografis"
        width={width}
      >
        {renderEntityContent()}
      </SheetContent>
    </Sheet>
  );
}
