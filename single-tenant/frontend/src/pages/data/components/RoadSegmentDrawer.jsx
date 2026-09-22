import React, { useState } from "react";
import {
  ShieldAlert,
  MapPin,
  Tag,
  Copy,
  Check,
  ExternalLink,
  X,
  Navigation,
  Layers,
  Info,
  Maximize2,
} from "lucide-react";
import { Button, Badge } from "@/components/primitives";

export function RoadSegmentDrawer({
  selectedSegment,
  onClose,
  onZoomToSegment,
}) {
  const [copied, setCopied] = useState(false);

  if (!selectedSegment) return null;

  const props = selectedSegment.properties || {};
  const geom = selectedSegment.geometry || {};
  const coordinates = geom.coordinates || [];
  const vertexCount = coordinates.length;

  const isToll =
    props.restriction_type === "PROHIBITED_TOLL_ROAD" ||
    props.highway === "motorway" ||
    props.highway === "motorway_link";

  const roadName = props.name || "Ruas Jalan Tanpa Nama";
  const externalId = props.id || props.external_id || "N/A";
  const highwayType = props.highway || "unknown";
  const restrictionType = props.restriction_type || (isToll ? "PROHIBITED_TOLL_ROAD" : "PROHIBITED_ROAD");
  const metadata = props.metadata || {};
  const tags = metadata.tags || {};

  const handleCopyId = () => {
    if (externalId) {
      navigator.clipboard.writeText(externalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculate mid-coordinate for display
  const midIndex = Math.floor(vertexCount / 2);
  const midCoord = coordinates[midIndex] || [0, 0];

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg flex flex-col overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex items-start justify-between gap-3 bg-[var(--muted)]/20">
        <div className="flex items-start gap-2.5">
          <div
            className={`p-2 rounded-lg mt-0.5 ${
              isToll
                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge
                variant={isToll ? "destructive" : "warning"}
                className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5"
              >
                {isToll ? "Jalan Tol" : "Jalan Protokol"}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                {highwayType}
              </Badge>
            </div>
            <h3 className="text-base font-bold text-[var(--foreground)] leading-snug">
              {roadName}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          title="Tutup Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto custom-scrollbar text-xs">
        {/* Core Attributes */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] block mb-1">
              External ID / OSM
            </span>
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-xs truncate text-[var(--foreground)] font-medium">
                {externalId}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 hover:text-[var(--primary)] text-[var(--muted-foreground)] transition-colors shrink-0"
                title="Copy ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] block mb-1">
              Geometri LineString
            </span>
            <div className="flex items-center gap-1.5 text-[var(--foreground)] font-medium">
              <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>{vertexCount} Vertices / Titik</span>
            </div>
          </div>
        </div>

        {/* Spatial Coordinates Info */}
        <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">
              Titik Tengah Segmen
            </span>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
              EPSG:4326
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--foreground)] font-medium">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              {midCoord[1]?.toFixed(6)}, {midCoord[0]?.toFixed(6)}
            </span>
          </div>
        </div>

        {/* OSM Metadata Tags if present */}
        {Object.keys(tags).length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] flex items-center gap-1">
              <Tag className="w-3 h-3" /> OSM Attributes & Tags
            </span>
            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
              {Object.entries(tags).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                  <span className="text-[11px] font-mono text-[var(--muted-foreground)] shrink-0">
                    {key}
                  </span>
                  <span className="text-[11px] text-[var(--foreground)] font-medium text-right truncate">
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PostGIS Status Alert */}
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-start gap-2 text-[11px]">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">ADR-PR-04A Validated</p>
            <p className="opacity-90">
              Segmen terdaftar dalam tabel PostGIS <code className="font-mono">protocol_roads</code> dan aktif memblokir rekomendasi rute armada roda dua.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--muted)]/10 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onZoomToSegment}
          className="flex-1 gap-1.5 text-xs"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fokuskan Peta
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-xs"
        >
          Tutup
        </Button>
      </div>
    </div>
  );
}
