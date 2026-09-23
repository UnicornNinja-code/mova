import React, { useState } from "react";
import {
  ShieldAlert,
  MapPin,
  Tag,
  Copy,
  Check,
  X,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button, Badge } from "@/components/primitives";

export function RoadSegmentDrawer({
  selectedSegment,
  onClose,
  onZoomToSegment,
}) {
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!selectedSegment) return null;

  const props = selectedSegment.properties || {};
  const geom = selectedSegment.geometry || {};
  const coordinates = geom.coordinates || [];
  const isMulti = geom.type === "MultiLineString";

  // Total vertices count
  let vertexCount = 0;
  if (isMulti) {
    vertexCount = coordinates.reduce((acc, line) => acc + (line?.length || 0), 0);
  } else {
    vertexCount = coordinates.length;
  }

  const isToll =
    props.restriction_type === "PROHIBITED_TOLL_ROAD" ||
    props.highway === "motorway" ||
    props.highway === "motorway_link";

  const roadName = props.name || "Ruas Jalan Tanpa Nama";
  const externalId = props.id || props.external_id || "N/A";
  const highwayType = props.highway || "sekunder";

  const handleCopyId = () => {
    if (externalId) {
      navigator.clipboard.writeText(externalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculate approximate coordinate for display
  let midCoord = [0, 0];
  if (isMulti && coordinates[0]?.length > 0) {
    const firstLine = coordinates[0];
    midCoord = firstLine[Math.floor(firstLine.length / 2)] || [0, 0];
  } else if (coordinates.length > 0) {
    midCoord = coordinates[Math.floor(coordinates.length / 2)] || [0, 0];
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-sm p-4 text-xs space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded mt-0.5 shrink-0 ${
              isToll
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge
                variant={isToll ? "destructive" : "warning"}
                className="text-[10px] font-bold uppercase px-2 py-0.5"
              >
                {isToll ? "Jalan Tol" : "Jalan Protokol"}
              </Badge>
              <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                Dilarang untuk operasional berjualan armada MOVA
              </span>
            </div>
            <h3 className="text-base font-bold text-[var(--foreground)] leading-snug">
              {roadName}
            </h3>
            <span className="text-xs text-[var(--muted-foreground)]">
              Klasifikasi: <strong className="text-[var(--foreground)] capitalize font-medium">{highwayType.replace(/_/g, " ")}</strong>
              {isMulti && " · Gabungan Segmen Jalur Utuh"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onZoomToSegment}
            className="text-xs gap-1.5 h-8 font-medium px-3"
          >
            <Compass className="w-3.5 h-3.5 text-[var(--primary)]" />
            Fokuskan ke Ruas Ini
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Tutup rincian jalan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progressive Disclosure: Collapsible Technical Metadata */}
      <div>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <span>Informasi Teknis & Spasial Ruas</span>
          {showTechnicalDetails ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-dashed border-[var(--border)] text-[11px]">
            <div className="bg-[var(--background)] p-2 rounded border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">ID Sumber (OSM)</span>
              <div className="flex items-center gap-1">
                <span className="font-mono font-medium text-[var(--foreground)] truncate max-w-[120px]">
                  {externalId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                  title="Salin ID"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="bg-[var(--background)] p-2 rounded border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Sistem Koordinat</span>
              <span className="font-mono text-[var(--foreground)]">EPSG:4326</span>
            </div>

            <div className="bg-[var(--background)] p-2 rounded border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Tipe Geometri</span>
              <span className="font-medium text-[var(--foreground)]">
                {geom.type} ({vertexCount} titik)
              </span>
            </div>

            <div className="bg-[var(--background)] p-2 rounded border border-[var(--border)] flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Titik Koordinat</span>
              <span className="font-mono text-[var(--foreground)]">
                {midCoord[1]?.toFixed(5)}, {midCoord[0]?.toFixed(5)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
