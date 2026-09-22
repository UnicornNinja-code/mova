import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Layers,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button, Badge, Spinner } from "@/components/primitives";
import { roadService } from "@/services/roadService";
import { RoadMapCanvas } from "./components/RoadMapCanvas";
import { RoadControlPanel } from "./components/RoadControlPanel";
import { RoadSegmentDrawer } from "./components/RoadSegmentDrawer";

export function RoadRestrictionsPage() {
  const queryClient = useQueryClient();

  const [showProtocol, setShowProtocol] = useState(true);
  const [showToll, setShowToll] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [focusSegment, setFocusSegment] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncStatus, setSyncStatus] = useState(null);

  // 1. Fetch Protocol Roads GeoJSON
  const {
    data: protocolData,
    isLoading: isLoadingProtocol,
    isRefetching: isRefetchingProtocol,
    refetch: refetchProtocol,
  } = useQuery({
    queryKey: ["roads", "protocol"],
    queryFn: () => roadService.getProtocolRoads(),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // 2. Fetch Toll Roads GeoJSON
  const {
    data: tollData,
    isLoading: isLoadingToll,
    isRefetching: isRefetchingToll,
    refetch: refetchToll,
  } = useQuery({
    queryKey: ["roads", "toll"],
    queryFn: () => roadService.getTollRoads(),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Protocol & Toll features count
  const protocolFeatures = useMemo(() => protocolData?.features || [], [protocolData]);
  const tollFeatures = useMemo(() => tollData?.features || [], [tollData]);

  const protocolCount = protocolFeatures.length;
  const tollCount = tollFeatures.length;
  const isLoading = isLoadingProtocol || isLoadingToll;

  // 3. Sync Mutations
  const syncProtocolMutation = useMutation({
    mutationFn: (hubCity = "Sidoarjo") => roadService.syncProtocolRoads(hubCity),
    onSuccess: (data) => {
      setSyncStatus({
        success: true,
        message: data.message || "Sinkronisasi Jalan Protokol berhasil.",
        source: data.source || "OVERPASS_API",
        acquiredAt: data.acquiredAt || new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["roads", "protocol"] });
    },
    onError: (err) => {
      setSyncStatus({
        success: false,
        message: err?.response?.data?.message || err.message || "Gagal menyinkronkan Jalan Protokol.",
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
        message: data.message || "Sinkronisasi Jalan Tol berhasil.",
        source: data.source || "OVERPASS_API",
        acquiredAt: data.acquiredAt || new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["roads", "toll"] });
    },
    onError: (err) => {
      setSyncStatus({
        success: false,
        message: err?.response?.data?.message || err.message || "Gagal menyinkronkan Jalan Tol.",
        source: "ERROR",
        acquiredAt: new Date().toISOString(),
      });
    },
  });

  const isSyncing = syncProtocolMutation.isPending || syncTollMutation.isPending;

  const handleTriggerSync = (type) => {
    setSyncStatus(null);
    if (type === "TOLL") {
      syncTollMutation.mutate("Sidoarjo");
    } else if (type === "PROTOCOL") {
      syncProtocolMutation.mutate("Sidoarjo");
    }
  };

  // 4. In-Memory Search across loaded features
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-[var(--foreground)] tracking-tight">
              Data Jalan Protokol & Tol
            </h1>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 bg-[var(--muted)]/50">
              Spatial Restrictions Layer
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-[var(--muted-foreground)]">
            Monitoring spatial pembatasan jalan protokol (arteri/sekunder) dan jalan tol untuk keselamatan armada sepeda motor MOVA.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoading || isRefetchingProtocol || isRefetchingToll}
            className="text-xs gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoading || isRefetchingProtocol || isRefetchingToll ? "animate-spin" : ""
              }`}
            />
            Muat Ulang Layer
          </Button>
        </div>
      </div>

      {/* Main Split Grid (Map Canvas 70% + Control Drawer 30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Map Workspace (70% on desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-[600px] lg:min-h-[720px] h-full">
          {isLoading && !protocolData && !tollData ? (
            <div className="w-full h-full min-h-[600px] rounded-xl border border-[var(--border)] flex flex-col items-center justify-center bg-[var(--card)] space-y-3">
              <Spinner size="lg" label="Memuat dataset spasial PostGIS..." />
              <p className="text-xs text-[var(--muted-foreground)]">
                Mengambil data GeoJSON LineString Jalan Protokol & Tol Sidoarjo...
              </p>
            </div>
          ) : (
            <RoadMapCanvas
              protocolGeoJson={protocolData}
              tollGeoJson={tollData}
              showProtocol={showProtocol}
              showToll={showToll}
              selectedSegment={selectedSegment}
              onSelectSegment={handleSelectSegment}
              focusSegment={focusSegment}
            />
          )}
        </div>

        {/* Right Side: Control Panel & Inspector Drawer (30% on desktop) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Segment Inspector Drawer */}
          {selectedSegment && (
            <RoadSegmentDrawer
              selectedSegment={selectedSegment}
              onClose={() => setSelectedSegment(null)}
              onZoomToSegment={handleZoomToSelected}
            />
          )}

          {/* Road Control Panel */}
          <RoadControlPanel
            protocolCount={protocolCount}
            tollCount={tollCount}
            isLoading={isLoading}
            showProtocol={showProtocol}
            setShowProtocol={setShowProtocol}
            showToll={showToll}
            setShowToll={setShowToll}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSelectSegment={handleSelectSegment}
            onTriggerSync={handleTriggerSync}
            isSyncing={isSyncing}
            syncStatus={syncStatus}
            onResetView={() => setFocusSegment({ geometry: { type: "Point", coordinates: [112.7183, -7.4478] } })}
          />
        </div>
      </div>
    </div>
  );
}

export default RoadRestrictionsPage;
