import React from "react";
import { Plus, Minus, Crosshair, Layers, RefreshCw, Focus } from "lucide-react";
import { IconButton } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { SIDOARJO_CENTER, DEFAULT_ZOOM } from "./MapContainer";

export function MapToolbar({
  map,
  onFitAllZones,
  onRefresh,
  className,
}) {
  const handleZoomIn = () => {
    if (map) map.zoomIn();
  };

  const handleZoomOut = () => {
    if (map) map.zoomOut();
  };

  const handleResetCenter = () => {
    if (map) map.setView(SIDOARJO_CENTER, DEFAULT_ZOOM);
  };

  return (
    <div className={cn("absolute top-4 left-4 z-10 flex flex-col gap-1 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-[var(--radius-sm)] shadow-md", className)}>
      <IconButton icon={Plus} label="Zoom In" size="sm" onClick={handleZoomIn} />
      <IconButton icon={Minus} label="Zoom Out" size="sm" onClick={handleZoomOut} />
      <div className="h-[1px] bg-[var(--border-subtle)] my-0.5" />
      <IconButton icon={Crosshair} label="Pusatkan ke Sidoarjo Hub" size="sm" onClick={handleResetCenter} />
      {onFitAllZones && (
        <IconButton icon={Focus} label="Fokus Seluruh Zona" size="sm" onClick={onFitAllZones} />
      )}
      {onRefresh && (
        <IconButton icon={RefreshCw} label="Segarkan Data Spasial" size="sm" onClick={onRefresh} />
      )}
    </div>
  );
}

export function MapLayerControl({
  layers = {
    zones: true,
    spots: true,
    roads: true,
    competitors: true,
    riders: true,
  },
  counts = {},
  onToggleLayer,
  className,
}) {
  const layerLabels = [
    { key: "zones", label: "Zona Operasional", color: "#3B82F6" },
    { key: "spots", label: "Titik Rekomendasi TOPSIS", color: "#3B82F6" },
    { key: "roads", label: "Jalan Protokol & Tol (Terlarang)", color: "#EF4444" },
    { key: "competitors", label: "Survei Kompetitor", color: "#8B5CF6" },
    { key: "riders", label: "Rider Live Telemetry", color: "#10B981" },
  ];

  return (
    <div className={cn("absolute top-4 right-4 z-10 bg-[var(--surface)]/95 backdrop-blur-xs border border-[var(--border)] p-3 rounded-[var(--radius-sm)] shadow-md min-w-[220px] text-xs", className)}>
      <div className="flex items-center justify-between font-semibold text-[var(--text-primary)] mb-2.5 pb-1.5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Layer Spasial GIS</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {layerLabels.map(({ key, label, color }) => {
          const isActive = layers[key] !== false;
          const count = counts[key];
          return (
            <label key={key} className="flex items-center justify-between cursor-pointer select-none hover:text-[var(--text-primary)] text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span>{label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {count !== undefined && (
                  <span className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                    {count}
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggleLayer && onToggleLayer(key)}
                  className="w-3.5 h-3.5 rounded-xs accent-[var(--accent-primary)] cursor-pointer"
                />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
