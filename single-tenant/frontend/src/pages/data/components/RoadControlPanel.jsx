import React, { useState } from "react";
import {
  ShieldAlert,
  Layers,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Eye,
  EyeOff,
  Filter,
  Flame,
  Zap,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/primitives";
import { useAuthStore } from "@/stores/useAuthStore";

export function RoadControlPanel({
  protocolCount = 0,
  tollCount = 0,
  isLoading = false,
  showProtocol = true,
  setShowProtocol,
  showToll = true,
  setShowToll,
  searchQuery = "",
  setSearchQuery,
  searchResults = [],
  onSelectSegment,
  onTriggerSync,
  isSyncing = false,
  syncStatus = null,
  onResetView,
}) {
  const user = useAuthStore((state) => state.user);
  const isSuperadmin = user?.role === "SUPERADMIN";

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // "TOLL" or "PROTOCOL"
  });

  const totalCount = protocolCount + tollCount;

  const handleOpenSync = (type) => {
    setConfirmModal({
      isOpen: true,
      type,
    });
  };

  const handleConfirmSync = () => {
    const type = confirmModal.type;
    setConfirmModal({ isOpen: false, type: null });
    if (onTriggerSync) {
      onTriggerSync(type);
    }
  };

  return (
    <div className="space-y-4">
      {/* Vitals Summary Card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)] leading-none">
                Spatial Restrictions Vitals
              </h2>
              <span className="text-[10px] text-[var(--muted-foreground)]">
                PostGIS Production Dataset (EPSG:4326)
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
            ADR-PR-04A
          </Badge>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
            <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] block mb-0.5">
              Jalan Protokol
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-[var(--foreground)]">
                {isLoading ? "..." : protocolCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">segmen</span>
            </div>
            <span className="text-[10px] text-amber-500 font-medium mt-1 inline-block">
              PROHIBITED_ROAD
            </span>
          </div>

          <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-red-500" />
            <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] block mb-0.5">
              Jalan Tol
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-[var(--foreground)]">
                {isLoading ? "..." : tollCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">segmen</span>
            </div>
            <span className="text-[10px] text-red-500 font-medium mt-1 inline-block">
              PROHIBITED_TOLL_ROAD
            </span>
          </div>
        </div>

        {/* Total & Status Row */}
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)]/20 rounded-lg border border-[var(--border)] text-xs">
          <span className="text-[var(--muted-foreground)] font-medium">Total Ruas Restriksi Aktif</span>
          <span className="font-bold text-[var(--foreground)] font-mono">
            {isLoading ? "..." : `${totalCount.toLocaleString()} Ruas`}
          </span>
        </div>
      </div>

      {/* Layer Visibility & Quick Controls */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Layer Visibilitas Peta
          </h3>
          <button
            onClick={onResetView}
            className="text-[11px] text-[var(--primary)] hover:underline font-medium"
          >
            Reset Kamera Peta
          </button>
        </div>

        <div className="space-y-2">
          {/* Protocol Toggle */}
          <button
            type="button"
            onClick={() => setShowProtocol(!showProtocol)}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
              showProtocol
                ? "bg-amber-500/10 border-amber-500/30 text-[var(--foreground)]"
                : "bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] opacity-60"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-bold leading-none">Jalan Protokol (Arteri / Sekunder)</p>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                  {protocolCount.toLocaleString()} segmen terdeteksi
                </p>
              </div>
            </div>
            {showProtocol ? <Eye className="w-4 h-4 text-amber-500" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Toll Toggle */}
          <button
            type="button"
            onClick={() => setShowToll(!showToll)}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
              showToll
                ? "bg-red-500/10 border-red-500/30 text-[var(--foreground)]"
                : "bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] opacity-60"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <div>
                <p className="text-xs font-bold leading-none">Jalan Tol (Bebas Hambatan)</p>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                  {tollCount.toLocaleString()} segmen terdeteksi
                </p>
              </div>
            </div>
            {showToll ? <Eye className="w-4 h-4 text-red-500" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Search Ruas Jalan */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" /> Cari Ruas Restriksi
        </h3>
        <div className="relative">
          <Input
            placeholder="Cari nama jalan atau OSM ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs pl-8 bg-[var(--background)]"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
        </div>

        {searchQuery.trim() !== "" && (
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar border border-[var(--border)] rounded-lg p-1 bg-[var(--background)]">
            {searchResults.length === 0 ? (
              <div className="p-3 text-center text-xs text-[var(--muted-foreground)]">
                Tidak ada ruas jalan yang cocok dengan "{searchQuery}"
              </div>
            ) : (
              searchResults.slice(0, 15).map((seg, idx) => {
                const p = seg.properties || {};
                const isSegToll = p.restriction_type === "PROHIBITED_TOLL_ROAD";
                return (
                  <button
                    key={`${p.id || p.external_id || idx}`}
                    onClick={() => onSelectSegment(seg)}
                    className="w-full flex items-center justify-between p-2 rounded-md hover:bg-[var(--muted)]/50 text-left transition-colors group"
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] truncate">
                        {p.name || "Ruas Jalan Tanpa Nama"}
                      </p>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                        {p.highway || "way"} · {p.id || p.external_id}
                      </span>
                    </div>
                    <Badge
                      variant={isSegToll ? "destructive" : "warning"}
                      className="text-[9px] uppercase px-1.5 py-0 shrink-0 font-bold"
                    >
                      {isSegToll ? "Tol" : "Protokol"}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Sync Trigger Actions */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Overpass Sync Ingestion
          </h3>
          {isSuperadmin && (
            <Badge variant="outline" className="text-[9px] text-[var(--primary)] border-[var(--primary)]/30">
              Superadmin
            </Badge>
          )}
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">
          Sinkronisasi spatial memicu live fetch dari Overpass API dengan fallback PostGIS snapshot untuk memperbarui layer restriksi.
        </p>

        {/* Sync Status Banner if available */}
        {syncStatus && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              syncStatus.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
            }`}
          >
            {syncStatus.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{syncStatus.message}</p>
              {syncStatus.acquiredAt && (
                <p className="text-[10px] opacity-80 mt-0.5 font-mono">
                  Waktu: {new Date(syncStatus.acquiredAt).toLocaleTimeString("id-ID")} · Source: {syncStatus.source}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!isSuperadmin || isSyncing}
            onClick={() => handleOpenSync("PROTOCOL")}
            className="text-xs justify-center gap-1.5 border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Protokol
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!isSuperadmin || isSyncing}
            onClick={() => handleOpenSync("TOLL")}
            className="text-xs justify-center gap-1.5 border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Tol
          </Button>
        </div>

        {!isSuperadmin && (
          <p className="text-[10px] text-[var(--muted-foreground)] italic text-center">
            * Hanya akun dengan role SUPERADMIN yang dapat memicu sinkronisasi Overpass.
          </p>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmModal.isOpen}
        onOpenChange={(open) => !open && setConfirmModal({ isOpen: false, type: null })}
      >
        <DialogContent className="sm:max-w-[420px] bg-[var(--card)] border-[var(--border)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--foreground)]">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Konfirmasi Sinkronisasi Overpass
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--muted-foreground)] pt-1">
              {confirmModal.type === "TOLL"
                ? "Sistem akan mengambil data Jalan Tol (motorway / toll=yes) terkini untuk Kabupaten Sidoarjo dari Overpass API dan memperbarui PostGIS."
                : "Sistem akan mengambil data Jalan Protokol (trunk, primary, secondary) terkini untuk Kabupaten Sidoarjo dari Overpass API dan memperbarui PostGIS."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border)] text-xs space-y-1">
            <p className="font-semibold text-[var(--foreground)]">Pipeline Ingestion:</p>
            <p className="text-[var(--muted-foreground)]">
              1. Fetch Live Overpass (Fallback ke local snapshot jika timeout)
            </p>
            <p className="text-[var(--muted-foreground)]">
              2. Transformasi ke LineString & Validasi PostGIS EPSG:4326
            </p>
            <p className="text-[var(--muted-foreground)]">
              3. Klasifikasi Presedensi ADR-PR-04A & Bulk Upsert
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmModal({ isOpen: false, type: null })}
            >
              Batal
            </Button>
            <Button
              variant={confirmModal.type === "TOLL" ? "destructive" : "warning"}
              size="sm"
              onClick={handleConfirmSync}
            >
              Mulai Sinkronisasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
