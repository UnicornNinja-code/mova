import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  X,
  Compass,
} from "lucide-react";
import { Button, Badge, Input } from "@/components/primitives";

const SIDOARJO_CENTER = [-7.4478, 112.7183];
const DEFAULT_ZOOM = 12;

export function RoadMapCanvas({
  protocolGeoJson,
  tollGeoJson,
  showProtocol = true,
  setShowProtocol,
  showToll = true,
  setShowToll,
  protocolCount = 0,
  tollCount = 0,
  searchQuery = "",
  setSearchQuery,
  searchResults = [],
  selectedSegment = null,
  onSelectSegment,
  focusSegment = null,
  onResetView,
  onOpenSyncModal,
  isSyncing = false,
  isSuperadmin = false,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const protocolLayerRef = useRef(null);
  const tollLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);

  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let resizeObserver = null;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: SIDOARJO_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: ["a", "b", "c"],
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | MOVA Operations',
      }).addTo(map);

      map.on("zoomend", () => {
        setMapZoom(map.getZoom());
      });

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      mapInstanceRef.current = map;
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Protocol Roads Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (protocolLayerRef.current) {
      map.removeLayer(protocolLayerRef.current);
      protocolLayerRef.current = null;
    }

    if (showProtocol && protocolGeoJson?.features?.length > 0) {
      const layer = L.geoJSON(protocolGeoJson, {
        style: () => ({
          color: "#d97706", // Amber 600
          weight: 3.5,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }),
        onEachFeature: (feature, layerItem) => {
          const props = feature.properties || {};
          const name = props.name || "Jalan Protokol (Tanpa Nama)";
          const hType = (props.highway || "sekunder").replace(/_/g, " ");

          layerItem.bindTooltip(
            `<div style="font-family: inherit; font-size: 11px; padding: 2px 4px;">
              <strong style="color: #b45309;">[JALAN PROTOKOL]</strong> ${name}<br/>
              <span style="color: #6b7280; font-size: 10px;">Tipe: ${hType} · Dilarang untuk berjualan</span>
            </div>`,
            { sticky: true, className: "mova-road-tooltip" }
          );

          layerItem.on({
            mouseover: (e) => {
              const target = e.target;
              target.setStyle({
                weight: 5.5,
                opacity: 1.0,
                color: "#92400e",
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: (e) => {
              const target = e.target;
              target.setStyle({
                color: "#d97706",
                weight: 3.5,
                opacity: 0.9,
              });
            },
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              if (onSelectSegment) {
                onSelectSegment(feature);
              }
            },
          });
        },
      });

      layer.addTo(map);
      protocolLayerRef.current = layer;
    }
  }, [protocolGeoJson, showProtocol, onSelectSegment]);

  // Update Toll Roads Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tollLayerRef.current) {
      map.removeLayer(tollLayerRef.current);
      tollLayerRef.current = null;
    }

    if (showToll && tollGeoJson?.features?.length > 0) {
      const layer = L.geoJSON(tollGeoJson, {
        style: () => ({
          color: "#da1e28", // Carbon Red 60
          weight: 4.5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }),
        onEachFeature: (feature, layerItem) => {
          const props = feature.properties || {};
          const name = props.name || "Ruas Jalan Tol";
          const hType = (props.highway || "motorway").replace(/_/g, " ");

          layerItem.bindTooltip(
            `<div style="font-family: inherit; font-size: 11px; padding: 2px 4px;">
              <strong style="color: #da1e28;">[JALAN TOL]</strong> ${name}<br/>
              <span style="color: #6b7280; font-size: 10px;">Bebas Hambatan · DILARANG MOTOR & BERJUALAN</span>
            </div>`,
            { sticky: true, className: "mova-road-tooltip" }
          );

          layerItem.on({
            mouseover: (e) => {
              const target = e.target;
              target.setStyle({
                weight: 6.5,
                opacity: 1.0,
                color: "#a2191f",
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: (e) => {
              const target = e.target;
              target.setStyle({
                color: "#da1e28",
                weight: 4.5,
                opacity: 0.95,
              });
            },
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              if (onSelectSegment) {
                onSelectSegment(feature);
              }
            },
          });
        },
      });

      layer.addTo(map);
      tollLayerRef.current = layer;
    }
  }, [tollGeoJson, showToll, onSelectSegment]);

  // Update Highlight Layer on selectedSegment
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (highlightLayerRef.current) {
      map.removeLayer(highlightLayerRef.current);
      highlightLayerRef.current = null;
    }

    if (selectedSegment && selectedSegment.geometry) {
      const highlightOuter = L.geoJSON(selectedSegment, {
        style: {
          color: "#0f62fe", // Carbon Blue 60
          weight: 8,
          opacity: 0.8,
          lineCap: "round",
          lineJoin: "round",
        },
      });

      const highlightInner = L.geoJSON(selectedSegment, {
        style: {
          color: "#ffffff",
          weight: 3.5,
          opacity: 1.0,
          lineCap: "round",
          lineJoin: "round",
        },
      });

      const highlightGroup = L.featureGroup([highlightOuter, highlightInner]);
      highlightGroup.addTo(map);
      highlightGroup.bringToFront();
      highlightLayerRef.current = highlightGroup;
    }
  }, [selectedSegment]);

  // Focus segment trigger
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusSegment?.geometry) return;

    try {
      const tempLayer = L.geoJSON(focusSegment);
      const bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [80, 80],
          maxZoom: 16,
          animate: true,
          duration: 0.6,
        });
      }
    } catch (e) {
      console.warn("Failed to fit bounds on segment:", e);
    }
  }, [focusSegment]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleResetToOperations = () => {
    if (onResetView) {
      onResetView();
      return;
    }
    const map = mapInstanceRef.current;
    if (!map) return;

    const layers = [];
    if (showProtocol && protocolLayerRef.current) layers.push(protocolLayerRef.current);
    if (showToll && tollLayerRef.current) layers.push(tollLayerRef.current);

    if (layers.length > 0) {
      const group = L.featureGroup(layers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
        return;
      }
    }

    map.setView(SIDOARJO_CENTER, DEFAULT_ZOOM);
  };

  return (
    <div className="relative w-full h-[620px] rounded-lg overflow-hidden border border-[var(--border)] shadow-sm bg-[var(--background)]">
      {/* Map DOM node */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* 1. TOP-LEFT FLOATING WIDGET: Filter Layer + Pencarian Cepat */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 pointer-events-auto">
        {/* Layer Filter Pill */}
        <div className="bg-[var(--card)] border border-[var(--border)] px-2.5 py-1.5 rounded shadow-md flex items-center gap-2">
          {/* Protokol Toggle */}
          <button
            type="button"
            onClick={() => setShowProtocol(!showProtocol)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              showProtocol
                ? "bg-amber-500/10 text-[var(--foreground)] border border-amber-500/30"
                : "text-[var(--muted-foreground)] opacity-60 hover:opacity-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
            <span className="font-semibold">Protokol</span>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
              ({protocolCount.toLocaleString()})
            </span>
          </button>

          {/* Tol Toggle */}
          <button
            type="button"
            onClick={() => setShowToll(!showToll)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              showToll
                ? "bg-red-500/10 text-[var(--foreground)] border border-red-500/30"
                : "text-[var(--muted-foreground)] opacity-60 hover:opacity-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600 shrink-0" />
            <span className="font-semibold">Tol</span>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
              ({tollCount.toLocaleString()})
            </span>
          </button>

          <div className="w-[1px] h-5 bg-[var(--border)] mx-0.5" />

          {/* Quick Search Input */}
          <div className="relative">
            <Input
              placeholder="Cari jalan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="text-xs pl-7 pr-6 h-7 w-44 md:w-56 bg-[var(--background)]"
            />
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Quick Search Dropdown Results */}
            {searchQuery.trim() !== "" && (
              <div className="absolute left-0 top-full mt-1.5 w-64 md:w-80 bg-[var(--card)] border border-[var(--border)] rounded shadow-xl max-h-56 overflow-y-auto custom-scrollbar p-1 z-50">
                {searchResults.length === 0 ? (
                  <div className="p-2.5 text-center text-xs text-[var(--muted-foreground)]">
                    Tidak ada jalan cocok "{searchQuery}"
                  </div>
                ) : (
                  searchResults.slice(0, 10).map((seg, idx) => {
                    const p = seg.properties || {};
                    const isSegToll =
                      p.restriction_type === "PROHIBITED_TOLL_ROAD" ||
                      p.highway === "motorway" ||
                      p.highway === "motorway_link";
                    const roadTitle = p.name || "Ruas Jalan Tanpa Nama";

                    return (
                      <button
                        key={`${p.id || p.external_id || idx}`}
                        type="button"
                        onClick={() => {
                          onSelectSegment(seg);
                          setIsSearchFocused(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded hover:bg-[var(--muted)]/50 text-left transition-colors group"
                      >
                        <div className="truncate pr-2">
                          <p className="text-xs font-medium text-[var(--foreground)] group-hover:text-[var(--primary)] truncate">
                            {roadTitle}
                          </p>
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {isSegToll ? "Jalan Bebas Hambatan" : "Jalan Protokol / Arteri"}
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
        </div>
      </div>

      {/* 2. TOP-RIGHT FLOATING WIDGET: Tombol Aksi Peta */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2 pointer-events-auto">
        <div className="bg-[var(--card)] border border-[var(--border)] p-1 rounded shadow-md flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToOperations}
            className="text-xs gap-1.5 h-7 font-medium px-2.5"
            title="Kembali ke Area Operasi Sidoarjo"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--foreground)]" />
            <span className="hidden sm:inline">Kembali ke Area Operasi</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={!isSuperadmin || isSyncing}
            onClick={onOpenSyncModal}
            className="text-xs gap-1.5 h-7 font-medium px-2.5"
            title={!isSuperadmin ? "Perlu hak akses Superadmin" : "Perbarui data jalan dari OpenStreetMap"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Menyinkronkan..." : "Perbarui Data"}</span>
          </Button>
        </div>
      </div>

      {/* 3. LEFT ZOOM CONTROLS */}
      <div className="absolute top-20 left-3 z-[400] flex flex-col gap-1 pointer-events-auto">
        <div className="bg-[var(--card)] border border-[var(--border)] p-1 rounded shadow-md flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="w-7 h-7 rounded hover:bg-[var(--muted)]"
            title="Perbesar Peta"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[var(--foreground)]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="w-7 h-7 rounded hover:bg-[var(--muted)]"
            title="Perkecil Peta"
          >
            <ZoomOut className="w-3.5 h-3.5 text-[var(--foreground)]" />
          </Button>
        </div>
      </div>

      {/* 4. BOTTOM-LEFT LEGENDA */}
      <div className="absolute bottom-3 left-3 z-[400] bg-[var(--card)] border border-[var(--border)] px-3 py-2 rounded shadow-md pointer-events-auto text-xs space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
          Legenda Peta
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded-sm bg-amber-600 inline-block" />
            <span className="text-[11px] font-medium text-[var(--foreground)]">Jalan Protokol</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded-sm bg-red-600 inline-block" />
            <span className="text-[11px] font-medium text-[var(--foreground)]">Jalan Tol</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded-sm bg-blue-600 inline-block" />
            <span className="text-[11px] font-medium text-[var(--foreground)]">Ruas Terpilih</span>
          </div>
        </div>
      </div>

      {/* 5. BOTTOM-RIGHT STATUS AREA OPERASI */}
      <div className="absolute bottom-3 right-3 z-[400] bg-[var(--card)] border border-[var(--border)] px-2.5 py-1 rounded shadow-sm text-[10px] font-mono text-[var(--muted-foreground)] pointer-events-none">
        Area Operasi: Kab. Sidoarjo · Zoom {mapZoom}
      </div>
    </div>
  );
}
