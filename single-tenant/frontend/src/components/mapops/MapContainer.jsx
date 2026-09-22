import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/primitives";
import {
  createRiderMarkerIcon,
  createPoiMarkerIcon,
  createHubMarkerIcon,
  getPoiIconUrl,
  getWeatherIconUrl,
} from "@/lib/iconRegistry";

// Export modern marker factories for seamless layer consumption
export {
  createRiderMarkerIcon,
  createPoiMarkerIcon,
  createHubMarkerIcon,
  getPoiIconUrl,
  getWeatherIconUrl,
};

// Standard Operational Hub Centers
export const SIDOARJO_CENTER = [-7.4478, 112.7183];
export const SURABAYA_CENTER = [-7.2575, 112.7521];
export const JAKARTA_CENTER = [-6.2088, 106.8456];
export const DEFAULT_ZOOM = 13;

/**
 * Legacy compatible helper mapping to modern createRiderMarkerIcon
 */
export function createPulsingRiderIcon(status = "COMPLIANT") {
  return createRiderMarkerIcon(status, { size: 30 });
}

export function createSpotIcon(rank = 1, score = null) {
  return L.divIcon({
    className: "mova-spot-marker",
    html: `
      <div style="background-color: #3B82F6; color: white; border: 2px solid white; font-weight: 700; font-size: 11px; font-family: monospace; border-radius: 4px; padding: 2px 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: inline-flex; align-items: center; gap: 2px;">
        <span>#${rank}</span>
        ${score !== null ? `<span style="font-size: 9px; opacity: 0.85;">(${score})</span>` : ""}
      </div>
    `,
    iconSize: [40, 24],
    iconAnchor: [20, 24],
    popupAnchor: [0, -24],
  });
}

export function createCompetitorIcon(brandName = "Kompetitor") {
  return L.divIcon({
    className: "mova-competitor-marker",
    html: `
      <div style="background-color: #8B5CF6; color: white; border: 2px solid white; font-size: 10px; font-weight: 600; border-radius: 4px; padding: 2px 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis;">
        ☕ ${brandName}
      </div>
    `,
    iconSize: [60, 22],
    iconAnchor: [30, 22],
    popupAnchor: [0, -22],
  });
}

export function MapCanvas({
  center = SIDOARJO_CENTER,
  zoom = DEFAULT_ZOOM,
  onMapReady,
  className,
  children,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: false, // Custom toolbar handles zoom
        attributionControl: true,
      });

      // Pure Standard OpenStreetMap Tile Layer (Free & No API Key Required)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: ["a", "b", "c"],
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;

      if (onMapReady) {
        onMapReady(map);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className={cn("relative w-full h-full min-h-[400px] overflow-hidden bg-[var(--background)]", className)}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {children}
    </div>
  );
}

export function MapContainer(props) {
  return (
    <ErrorBoundary title="Gagal Memuat Workspace Peta GIS">
      <MapCanvas {...props} />
    </ErrorBoundary>
  );
}
