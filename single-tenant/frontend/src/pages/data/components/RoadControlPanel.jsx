import React, { useState } from "react";
import {
  ShieldAlert,
  Layers,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  Info,
} from "lucide-react";
import {
  Button,
  Badge,
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
  onTriggerSync,
  isSyncing = false,
  syncStatus = null,
  lastUpdatedText = "Hari ini, 18:42",
  confirmModalOpen,
  setConfirmModalOpen,
}) {
  const user = useAuthStore((state) => state.user);
  const isSuperadmin = user?.role === "SUPERADMIN";

  const [syncScope, setSyncScope] = useState("ALL");
  const [showErrorDetailModal, setShowErrorDetailModal] = useState(false);

  const totalCount = protocolCount + tollCount;

  const handleOpenSyncModal = () => {
    setConfirmModalOpen(true);
  };

  const handleExecuteSync = () => {
    setConfirmModalOpen(false);
    if (!onTriggerSync) return;

    if (syncScope === "ALL") {
      onTriggerSync("ALL");
    } else if (syncScope === "TOLL") {
      onTriggerSync("TOLL");
    } else {
      onTriggerSync("PROTOCOL");
    }
  };

  return (
    <div className="space-y-4">
      {/* 3-Kolom Horizontal Panel di Bawah Peta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Kolom 1: Ringkasan Jalan */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Ringkasan Jalan
              </h2>
              <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                Kab. Sidoarjo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[var(--background)] p-2.5 rounded border border-[var(--border)] relative overflow-hidden">
                <div className="w-1 h-full bg-amber-500 absolute top-0 left-0" />
                <div className="pl-1.5">
                  <span className="text-[11px] text-[var(--muted-foreground)] block">
                    Jalan Protokol
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                      {isLoading ? "..." : protocolCount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">ruas</span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--background)] p-2.5 rounded border border-[var(--border)] relative overflow-hidden">
                <div className="w-1 h-full bg-red-600 absolute top-0 left-0" />
                <div className="pl-1.5">
                  <span className="text-[11px] text-[var(--muted-foreground)] block">
                    Jalan Tol
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                      {isLoading ? "..." : tollCount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">ruas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)]/20 rounded border border-[var(--border)] text-xs mt-3">
            <span className="text-[var(--muted-foreground)]">Total Jalan Terlarang</span>
            <span className="font-bold text-[var(--foreground)] font-mono">
              {isLoading ? "..." : `${totalCount.toLocaleString()} Ruas`}
            </span>
          </div>
        </div>

        {/* Kolom 2: Status Data & Pembaruan */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Status Data
              </h3>
              {syncStatus?.success === false ? (
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                  Pembaruan Tertunda
                </Badge>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Tersinkronisasi
                </span>
              )}
            </div>

            {syncStatus?.success === false ? (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-xs space-y-1.5">
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-xs leading-snug">
                      Pembaruan data belum berhasil
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                      Data lokal tetap aman dan aktif digunakan.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowErrorDetailModal(true)}
                    className="text-[11px] text-[var(--primary)] hover:underline font-medium"
                  >
                    Lihat Detail
                  </button>
                  <span className="text-[var(--border)]">|</span>
                  <button
                    type="button"
                    onClick={handleOpenSyncModal}
                    disabled={!isSuperadmin || isSyncing}
                    className="text-[11px] text-[var(--foreground)] hover:underline font-medium"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs space-y-1.5 text-[var(--muted-foreground)]">
                <p className="text-[11px]">
                  Sumber: <strong className="text-[var(--foreground)] font-medium">OpenStreetMap (Overpass Ingestion)</strong>
                </p>
                <p className="text-[11px]">
                  Terakhir diperbarui:{" "}
                  <strong className="text-[var(--foreground)] font-medium">
                    {syncStatus?.acquiredAt
                      ? new Date(syncStatus.acquiredAt).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : lastUpdatedText}
                  </strong>
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)] italic">
                  Model PostGIS: LineString terintegrasi berbasis kesamaan nama jalan.
                </p>
              </div>
            )}
          </div>

          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!isSuperadmin || isSyncing}
              onClick={handleOpenSyncModal}
              className="w-full text-xs justify-center gap-1.5 h-8 font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Menyinkronkan dari OpenStreetMap..." : "Perbarui Data Sekarang"}
            </Button>
          </div>
        </div>

        {/* Kolom 3: Dampak Operasional MOVA */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Info className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                Dampak Operasional
              </h4>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Jalan tol dan jalan protokol yang ditampilkan <strong>tidak dapat dijadikan tempat operasional berjualan</strong> bagi armada sepeda motor MOVA.
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed mt-2">
              Data spasial ini secara otomatis digunakan sebagai batas restriksi saat Decision Support System (DSS) memvalidasi kepatuhan rute dan zona operasional harian.
            </p>
          </div>

          <div className="p-2 rounded bg-[var(--muted)]/20 border border-[var(--border)] text-[10px] text-[var(--muted-foreground)] mt-3">
            Kepatuhan Armada: Sepeda Motor dilarang berjualan di jalan arteri & tol.
          </div>
        </div>
      </div>

      {/* Confirmation Dialog: Perbarui Data */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-[var(--card)] border-[var(--border)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--foreground)]">
              <RefreshCw className="w-4 h-4 text-[var(--primary)]" />
              Perbarui Data Pembatasan Jalan
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--muted-foreground)] pt-1">
              Sistem akan mengambil data jaringan jalan terkini untuk wilayah Kabupaten Sidoarjo dan menyelaraskannya ke dataset operasional MOVA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <span className="text-[11px] font-semibold text-[var(--foreground)] block">
              Pilih Ruang Lingkup Pembaruan:
            </span>
            <div className="space-y-1.5">
              <label
                className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-colors ${
                  syncScope === "ALL"
                    ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/30"
                }`}
              >
                <input
                  type="radio"
                  name="syncScope"
                  value="ALL"
                  checked={syncScope === "ALL"}
                  onChange={() => setSyncScope("ALL")}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-xs font-semibold block text-[var(--foreground)]">
                    Semua Jalan (Rekomendasi)
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    Perbarui data Jalan Protokol dan Jalan Tol sekaligus.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-colors ${
                  syncScope === "PROTOCOL"
                    ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/30"
                }`}
              >
                <input
                  type="radio"
                  name="syncScope"
                  value="PROTOCOL"
                  checked={syncScope === "PROTOCOL"}
                  onChange={() => setSyncScope("PROTOCOL")}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-xs font-semibold block text-[var(--foreground)]">
                    Hanya Jalan Protokol
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    Jalan arteri primer dan sekunder.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer transition-colors ${
                  syncScope === "TOLL"
                    ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/30"
                }`}
              >
                <input
                  type="radio"
                  name="syncScope"
                  value="TOLL"
                  checked={syncScope === "TOLL"}
                  onChange={() => setSyncScope("TOLL")}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-xs font-semibold block text-[var(--foreground)]">
                    Hanya Jalan Tol
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    Jaringan jalan bebas hambatan.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteSync}
            >
              Mulai Pembaruan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Details Modal */}
      <Dialog open={showErrorDetailModal} onOpenChange={setShowErrorDetailModal}>
        <DialogContent className="sm:max-w-[440px] bg-[var(--card)] border-[var(--border)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              Rincian Kendala Pembaruan
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--muted-foreground)] pt-1">
              Catatan sistem mengenai percobaan pembaruan data terakhir:
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-[var(--background)] rounded border border-[var(--border)] font-mono text-[11px] text-[var(--foreground)] break-words space-y-1">
            <p className="text-[var(--muted-foreground)] text-[10px]">Pesan Sistem:</p>
            <p>{syncStatus?.message || "Tidak ada rincian kesalahan spesifik."}</p>
            {syncStatus?.acquiredAt && (
              <p className="text-[10px] text-[var(--muted-foreground)] pt-1">
                Waktu: {new Date(syncStatus.acquiredAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowErrorDetailModal(false)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
