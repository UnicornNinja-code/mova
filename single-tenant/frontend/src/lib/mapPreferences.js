/*
 * mapPreferences.js
 * Centralized Map Tile Provider Registry & User Preference Store
 * Single-Tenant MOVA Architecture
 * 
 * Supports:
 * 1. OpenStreetMap Standard (100% Free, Zero API Key required, Fast & Lightweight)
 * 2. MapTiler / OpenMapTiles Vector/Raster tiles (via VITE_MAPTILER_KEY if provided in .env)
 * 3. Esri World Imagery Satellite
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "mova_map_preferences";

/**
 * Sanitizes and extracts MapTiler API Key from Vite env
 * Strips accidental quotes or whitespace
 */
export const getMapTilerKey = () => {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_MAPTILER_KEY) ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_MAPTILER_API_KEY) ||
    "";
  return String(raw).replace(/^[\s'"]+|[\s'"]+$/g, "").trim();
};

/**
 * Returns list of supported basemap providers
 * Defaults and falls back to clean OpenStreetMap Standard (never broken Carto watermarks)
 */
export const getBasemapProviders = () => {
  const maptilerKey = getMapTilerKey();
  const hasKey = maptilerKey.length > 0;

  return [
    {
      id: "osm-standard",
      name: "OpenStreetMap Standard (Free & Ringan)",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
      tileSize: 256,
      zoomOffset: 0,
      isFree: true,
    },
    {
      id: "carto-dark",
      name: "Carto Dark Matter (High-Speed Gelap)",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      maxZoom: 19,
      subdomains: ["a", "b", "c", "d"],
      tileSize: 256,
      zoomOffset: 0,
      isFree: true,
    },
    {
      id: "carto-voyager",
      name: "Carto Voyager (High-Speed Detail)",
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      maxZoom: 19,
      subdomains: ["a", "b", "c", "d"],
      tileSize: 256,
      zoomOffset: 0,
      isFree: true,
    },
    {
      id: "openmaptiles-streets",
      name: "OpenMapTiles Streets (Jalan & Bangunan)",
      url: hasKey
        ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: hasKey
        ? '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a>'
        : '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      subdomains: hasKey ? undefined : ["a", "b", "c"],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      isFree: !hasKey,
    },
    {
      id: "openmaptiles-dark",
      name: "OpenMapTiles Dark (Kontras Gelap)",
      url: hasKey
        ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${maptilerKey}`
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: hasKey
        ? '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a>'
        : '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      subdomains: hasKey ? undefined : ["a", "b", "c"],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      isFree: !hasKey,
    },
    {
      id: "openmaptiles-satellite",
      name: "OpenMapTiles Satellite (Citra Satelit)",
      url: hasKey
        ? `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${maptilerKey}`
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: hasKey
        ? '&copy; MapTiler &copy; Esri'
        : '&copy; Esri & OpenStreetMap contributors',
      maxZoom: 19,
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      isFree: true,
    },
    {
      id: "openmaptiles-outdoor",
      name: "OpenMapTiles Outdoor (Topografi & Kontur)",
      url: hasKey
        ? `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${maptilerKey}`
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: hasKey
        ? '&copy; OpenMapTiles &copy; MapTiler'
        : '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      subdomains: hasKey ? undefined : ["a", "b", "c"],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      isFree: !hasKey,
    },
    {
      id: "openmaptiles-light",
      name: "OpenMapTiles Light (Terang Minimalis)",
      url: hasKey
        ? `https://api.maptiler.com/maps/dataviz-light/{z}/{x}/{y}.png?key=${maptilerKey}`
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: hasKey
        ? '&copy; OpenMapTiles &copy; MapTiler'
        : '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      subdomains: hasKey ? undefined : ["a", "b", "c"],
      tileSize: hasKey ? 512 : 256,
      zoomOffset: hasKey ? -1 : 0,
      isFree: !hasKey,
    },
  ];
};

// Static export for backward compatibility
export const BASEMAP_PROVIDERS = getBasemapProviders();

export const DEFAULT_STATE = {
  basemapId: "osm-standard",
  geofenceBufferMeters: 50,
};

export const getMapPreferences = () => {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    
    // Auto-migrate legacy Carto basemap to osm-standard if no valid MapTiler key exists
    const hasKey = getMapTilerKey().length > 0;
    if (
      (parsed.basemapId === "openmaptiles-dark" && !hasKey) ||
      parsed.basemapId === "carto-light" ||
      !parsed.basemapId
    ) {
      parsed.basemapId = "osm-standard";
    }

    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
};

export const saveMapPreferences = (state) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("mova:map_preferences_changed", { detail: state }));
  } catch (err) {
    console.warn("Failed to persist map preferences to localStorage:", err);
  }
};

export const getActiveBasemapProvider = () => {
  const prefs = getMapPreferences();
  const providers = getBasemapProviders();
  const provider = providers.find((p) => p.id === prefs.basemapId);
  return provider || providers[0];
};

export function useMapPreferences() {
  const [prefs, setPrefs] = useState(getMapPreferences);
  const providers = getBasemapProviders();

  useEffect(() => {
    const handleStorage = () => setPrefs(getMapPreferences());
    window.addEventListener("mova:map_preferences_changed", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("mova:map_preferences_changed", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setBasemapId = (id) => {
    const currentProviders = getBasemapProviders();
    if (currentProviders.some((p) => p.id === id)) {
      const updated = { ...prefs, basemapId: id };
      setPrefs(updated);
      saveMapPreferences(updated);
    }
  };

  const setBufferMeters = (meters) => {
    const clamped = Math.max(10, Math.min(150, meters));
    const updated = { ...prefs, geofenceBufferMeters: clamped };
    setPrefs(updated);
    saveMapPreferences(updated);
  };

  const resetDefaults = () => {
    setPrefs(DEFAULT_STATE);
    saveMapPreferences(DEFAULT_STATE);
  };

  const activeProvider =
    providers.find((p) => p.id === prefs.basemapId) || providers[0];

  return {
    prefs,
    activeProvider,
    providers,
    hasMapTilerKey: getMapTilerKey().length > 0,
    setBasemapId,
    setBufferMeters,
    resetDefaults,
  };
}
