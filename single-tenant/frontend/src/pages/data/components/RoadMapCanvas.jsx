import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Layers,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { Button, Badge } from "@/components/primitives";

// Sidoarjo Default Center
const SIDOARJO_CENTER = [-7.4478, 112.7183];
const DEFAULT_ZOOM = 12;

export function RoadMapCanvas({
  protocolGeoJson,
  tollGeoJson,
  showProtocol = true,
  showToll = true,
  selectedSegment = null,
  onSelectSegment,
  focusSegment = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const protocolLayerRef = useRef(null);
  const tollLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);

  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

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

      // Pure Standard OpenStreetMap Tile Layer with subdomains
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: ["a", "b", "c"],
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | MOVA GIS',
      }).addTo(map);

      map.on("zoomend", () => {
        setMapZoom(map.getZoom());
      });

      // Force recalculate dimensions so tiles render immediately
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

    // Remove old layer
    if (protocolLayerRef.current) {
      map.removeLayer(protocolLayerRef.current);
      protocolLayerRef.current = null;
    }

    if (showProtocol && protocolGeoJson?.features?.length > 0) {
      const layer = L.geoJSON(protocolGeoJson, {
        style: (feature) => ({
          color: "#F59E0B", // Amber Orange
          weight: 3.5,
          opacity: 0.85,
          lineCap: "round",
          lineJoin: "round",
        }),
        onEachFeature: (feature, layerItem) => {
          const props = feature.properties || {};
          const name = props.name || "Jalan Protokol (Tanpa Nama)";
          const hType = props.highway || "secondary";

          layerItem.bindTooltip(
            `<div style="font-family: sans-serif; font-size: 11px; padding: 2px 4px;">
              <strong style="color: #D97706;">[PROTOKOL]</strong> ${name}<br/>
              <span style="color: #6B7280; font-size: 10px;">Tipe: ${hType}</span>
            </div>`,
            { sticky: true, className: "mova-road-tooltip" }
          );

          layerItem.on({
            mouseover: (e) => {
              const target = e.target;
              target.setStyle({
                weight: 5.5,
                opacity: 1.0,
                color: "#D97706",
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: (e) => {
              const target = e.target;
              target.setStyle({
                color: "#F59E0B",
                weight: 3.5,
                opacity: 0.85,
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
        style: (feature) => ({
          color: "#EF4444", // Crimson Red
          weight: 4.5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }),
        onEachFeature: (feature, layerItem) => {
          const props = feature.properties || {};
          const name = props.name || "Ruas Jalan Tol";
          const hType = props.highway || "motorway";

          layerItem.bindTooltip(
            `<div style="font-family: sans-serif; font-size: 11px; padding: 2px 4px;">
              <strong style="color: #DC2626;">[JALAN TOL]</strong> ${name}<br/>
              <span style="color: #6B7280; font-size: 10px;">Tipe: ${hType} · DILARANG MOTOR</span>
            </div>`,
            { sticky: true, className: "mova-road-tooltip" }
          );

          layerItem.on({
            mouseover: (e) => {
              const target = e.target;
              target.setStyle({
                weight: 6.5,
                opacity: 1.0,
                color: "#B91C1C",
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: (e) => {
              const target = e.target;
              target.setStyle({
                color: "#EF4444",
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
      // Create double layer highlight (outer neon cyan/blue glow + inner line)
      const highlightOuter = L.geoJSON(selectedSegment, {
        style: {
          color: "#3B82F6", // Vivid blue glow
          weight: 9,
          opacity: 0.6,
          lineCap: "round",
          lineJoin: "round",
        },
      });

      const highlightInner = L.geoJSON(selectedSegment, {
        style: {
          color: "#FFFFFF",
          weight: 4,
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
          duration: 0.8,
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

  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layers = [];
    if (showProtocol && protocolLayerRef.current) layers.push(protocolLayerRef.current);
    if (showToll && tollLayerRef.current) layers.push(tollLayerRef.current);

    if (layers.length > 0) {
      const group = L.featureGroup(layers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
        return;
      }
    }

    map.setView(SIDOARJO_CENTER, DEFAULT_ZOOM);
  };

  return (
    <div className="relative w-full h-full min-h-[550px] rounded-xl overflow-hidden border border-[var(--border)] shadow-md bg-[var(--background)]">
      {/* Map DOM node */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Controls Top-Left */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-[var(--card)]/90 backdrop-blur-md border border-[var(--border)] p-1.5 rounded-lg shadow-lg flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded hover:bg-[var(--muted)]"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-[var(--foreground)]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded hover:bg-[var(--muted)]"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-[var(--foreground)]" />
          </Button>
          <div className="w-full h-[1px] bg-[var(--border)] my-0.5" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFitAll}
            className="w-8 h-8 rounded hover:bg-[var(--muted)]"
            title="Fit Sidoarjo Restriction Bounds"
          >
            <Maximize2 className="w-4 h-4 text-[var(--foreground)]" />
          </Button>
        </div>
      </div>

      {/* Floating Legend Bottom-Left */}
      <div className="absolute bottom-3 left-3 z-[400] bg-[var(--card)]/90 backdrop-blur-md border border-[var(--border)] px-3 py-2 rounded-lg shadow-lg pointer-events-auto text-xs space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
          Legenda Restriksi
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-[11px] font-medium text-[var(--foreground)]">Jalan Protokol</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-red-500 inline-block" />
            <span className="text-[11px] font-medium text-[var(--foreground)]">Jalan Tol</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-blue-500 inline-block" />
            <span className="text-[11px] font-medium text-[var(--foreground)]">Segmen Terpilih</span>
          </div>
        </div>
      </div>

      {/* Floating Coordinate Center Bottom-Right */}
      <div className="absolute bottom-3 right-3 z-[400] bg-[var(--card)]/90 backdrop-blur-md border border-[var(--border)] px-2.5 py-1 rounded-md shadow-md text-[10px] font-mono text-[var(--muted-foreground)] pointer-events-none">
        Zoom: {mapZoom} · PostGIS LineString Layer
      </div>
    </div>
  );
}
