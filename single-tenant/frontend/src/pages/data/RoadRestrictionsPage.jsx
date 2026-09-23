import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { Button, Spinner } from "@/components/primitives";
import { roadService } from "@/services/roadService";
import { useAuthStore } from "@/stores/useAuthStore";
import { RoadMapCanvas } from "./components/RoadMapCanvas";
import { RoadControlPanel } from "./components/RoadControlPanel";
import { RoadSegmentDrawer } from "./components/RoadSegmentDrawer";

export function RoadRestrictionsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isSuperadmin = user?.role === "SUPERADMIN";

  const [showProtocol, setShowProtocol] = useState(true);
  const [showToll, setShowToll] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [focusSegment, setFocusSegment] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncStatus, setSyncStatus] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // 1. Fetch Protocol Roads GeoJSON (Merged LineStrings from PostGIS)
  const {
    data: protocolData,
    isLoading: isLoadingProtocol,
    isRefetching: isRefetchingProtocol,
    refetch: refetchProtocol,
  } = useQuery({
    queryKey: ["roads", "protocol"],
    queryFn: () => roadService.getProtocolRoads(),
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Toll Roads GeoJSON (Merged LineStrings from PostGIS)
  const {
    data: tollData,
    isLoading: isLoadingToll,
    isRefetching: isRefetchingToll,
    refetch: refetchToll,
  } = useQuery({
    queryKey: ["roads", "toll"],
    queryFn: () => roadService.getTollRoads(),
    staleTime: 1000 * 60 * 5,
  });

  const protocolFeatures = useMemo(() => protocolData?.features || [], [protocolData]);
  const tollFeatures = useMemo(() => tollData?.features || [], [tollData]);

  const protocolCount = protocolFeatures.length;
  const tollCount = tollFeatures.length;
  const isLoading = isLoadingProtocol || isLoadingToll;

  // 3. Extended Timeout Sync Mutations (180s)
  const syncProtocolMutation = useMutation({
    mutationFn: (hubCity = "Sidoarjo") => roadService.syncProtocolRoads(hubCity),
    onSuccess: (data) => {
      setSyncStatus({
        success: true,
        message: data.message || "Data Jalan Protokol berhasil diperbarui.",
        source: data.source || "OpenStreetMap",
        acquiredAt: data.acquiredAt || new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["roads", "protocol"] });
    },
    onError: (err) => {
      setSyncStatus({
        success: false,
        message:
          err?.response?.data?.message ||
          "Koneksi ke penyedia data jalan sedang mengalami gangguan. Data lokal tetap aman digunakan.",
        source: "ERROR",
        acquiredAt: new Date().toISOString(),
      });
    },
  });

  const syncTollMutation = useMutation({
    mutationFn: (hubCity = "Sidoarjo") => roadService.syncTollRoads(hubCity),
    onSuccess: (data) => {
      setSyncStatus({
        success: true,
        message: data.message || "Data Jalan Tol berhasil diperbarui.",
        source: data.source || "OpenStreetMap",
        acquiredAt: data.acquiredAt || new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["roads", "toll"] });
    },
    onError: (err) => {
      setSyncStatus({
        success: false,
        message:
          err?.response?.data?.message ||
          "Koneksi ke penyedia data jalan sedang mengalami gangguan. Data lokal tetap aman digunakan.",
        source: "ERROR",
        acquiredAt: new Date().toISOString(),
      });
    },
  });

  const isSyncing = syncProtocolMutation.isPending || syncTollMutation.isPending;

  const handleTriggerSync = async (scope) => {
    setSyncStatus(null);
    if (scope === "TOLL") {
      syncTollMutation.mutate("Sidoarjo");
    } else if (scope === "PROTOCOL") {
      syncProtocolMutation.mutate("Sidoarjo");
    } else if (scope === "ALL") {
      try {
        await syncProtocolMutation.mutateAsync("Sidoarjo");
        await syncTollMutation.mutateAsync("Sidoarjo");
        setSyncStatus({
          success: true,
          message: "Seluruh data Jalan Protokol & Tol berhasil diperbarui dari OpenStreetMap.",
          source: "OpenStreetMap",
          acquiredAt: new Date().toISOString(),
        });
      } catch (err) {
        setSyncStatus({
          success: false,
          message:
            err?.response?.data?.message ||
            "Pembaruan data belum berhasil. Data yang ditampilkan tetap menggunakan versi terakhir.",
          source: "ERROR",
          acquiredAt: new Date().toISOString(),
        });
      }
    }
  };

  // 4. In-Memory Search
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const allFeatures = [...protocolFeatures, ...tollFeatures];
    return allFeatures.filter((f) => {
      const p = f.properties || {};
      const nameMatch = (p.name || "").toLowerCase().includes(query);
      const idMatch = (p.id || p.external_id || "").toLowerCase().includes(query);
      const highwayMatch = (p.highway || "").toLowerCase().includes(query);
      return nameMatch || idMatch || highwayMatch;
    });
  }, [searchQuery, protocolFeatures, tollFeatures]);

  const handleSelectSegment = (segment) => {
    setSelectedSegment(segment);
    setFocusSegment(segment);
  };

  const handleZoomToSelected = () => {
    if (selectedSegment) {
      setFocusSegment({ ...selectedSegment });
    }
  };

  const handleRefreshAll = () => {
    refetchProtocol();
    refetchToll();
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto p-4 md:p-6 text-[var(--foreground)]">
      {/* 1. Header Manusiawi dengan Deskripsi Larangan Berjualan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)] p-4 md:p-5 rounded-lg border border-[var(--border)] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)] tracking-tight">
              Jalan Protokol & Tol
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[var(--muted-foreground)]">
            Peta pembatasan rute dan area jalan yang tidak dapat dijadikan tempat operasional berjualan untuk armada MOVA.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoading || isRefetchingProtocol || isRefetchingToll}
            className="text-xs gap-1.5 h-8 font-medium"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoading || isRefetchingProtocol || isRefetchingToll ? "animate-spin" : ""
              }`}
            />
            Muat Ulang
          </Button>
        </div>
      </div>

      {/* 2. Horizontal View Main Canvas (Peta Lebar Penuh dengan Floating Widgets) */}
      <div className="w-full">
        {isLoading && !protocolData && !tollData ? (
          <div className="w-full h-[620px] rounded-lg border border-[var(--border)] flex flex-col items-center justify-center bg-[var(--card)] space-y-3">
            <Spinner size="lg" label="Menyiapkan data spasial jalan..." />
            <p className="text-xs text-[var(--muted-foreground)]">
              Mengambil rute jalan protokol & tol Kabupaten Sidoarjo...
            </p>
          </div>
        ) : (
          <RoadMapCanvas
            protocolGeoJson={protocolData}
            tollGeoJson={tollData}
            showProtocol={showProtocol}
            setShowProtocol={setShowProtocol}
            showToll={showToll}
            setShowToll={setShowToll}
            protocolCount={protocolCount}
            tollCount={tollCount}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            selectedSegment={selectedSegment}
            onSelectSegment={handleSelectSegment}
            focusSegment={focusSegment}
            onResetView={() =>
              setFocusSegment({
                geometry: { type: "Point", coordinates: [112.7183, -7.4478] },
              })
            }
            onOpenSyncModal={() => setConfirmModalOpen(true)}
            isSyncing={isSyncing}
            isSuperadmin={isSuperadmin}
          />
        )}
      </div>

      {/* 3. Panel Detail Ruas Terpilih (Muncul jika ada jalan yang diklik) */}
      {selectedSegment && (
        <RoadSegmentDrawer
          selectedSegment={selectedSegment}
          onClose={() => setSelectedSegment(null)}
          onZoomToSegment={handleZoomToSelected}
        />
      )}

      {/* 4. Panel Informasi Bawah (3-Kolom Horizontal: Ringkasan, Status, Dampak) */}
      <RoadControlPanel
        protocolCount={protocolCount}
        tollCount={tollCount}
        isLoading={isLoading}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        confirmModalOpen={confirmModalOpen}
        setConfirmModalOpen={setConfirmModalOpen}
      />
    </div>
  );
}

export default RoadRestrictionsPage;
