/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   MOVA Centralized Icon Registry & Leaflet Marker Factory
 */

import L from "leaflet";

/**
 * 1-to-1 Mapping from Master Category Name (DB) to Asset Slug
 */
export const POI_CATEGORY_ICON_SLUGS = {
  "Kafe & Kedai Kopi": "kafe-kedai-kopi",
  "Restoran": "restoran",
  "Cepat Saji": "cepat-saji",
  "Food Court": "food-court",
  "Toko Minuman": "toko-minuman",
  "Toko Roti & Kue": "toko-roti-kue",
  "Masjid & Mushola": "masjid-mushola",
  "Gereja": "gereja",
  "Pura": "pura",
  "Vihara": "vihara",
  "Tempat Ibadah": "tempat-ibadah",
  "Tempat Ibadah (Lainnya)": "tempat-ibadah-lainnya",
  "Objek Wisata & Budaya": "objek-wisata-budaya",
  "Taman Kota / Terbuka": "taman-kota-terbuka",
  "Taman & Ruang Terbuka": "taman-ruang-terbuka",
  "Fasilitas Olahraga": "fasilitas-olahraga",
  "Kolam Renang / Rekreasi Air": "kolam-renang-rekreasi-air",
  "Rumah Sakit": "rumah-sakit",
  "Klinik & Puskesmas": "klinik-puskesmas",
  "Apotek": "apotek",
  "Sekolah Dasar (SD/MI)": "sekolah-dasar-sd-mi",
  "Sekolah Menengah Pertama (SMP/MTs)": "sekolah-menengah-pertama-smp-mts",
  "Sekolah Menengah Atas (SMA/SMK/MA)": "sekolah-menengah-atas-sma-smk-ma",
  "Taman Kanak-Kanak / PAUD": "taman-kanak-kanak-paud",
  "Perguruan Tinggi": "perguruan-tinggi",
  "Pondok Pesantren": "pondok-pesantren",
  "Sekolah (Umum)": "sekolah-umum",
  "Sekolah & Universitas": "sekolah-universitas",
  "Minimarket": "minimarket",
  "Supermarket": "supermarket",
  "Mall / Pusat Perbelanjaan": "mall-pusat-perbelanjaan",
  "Pusat Perbelanjaan": "pusat-perbelanjaan",
  "Pasar Tradisional": "pasar-tradisional",
  "Toko Retail (Umum)": "toko-retail-umum",
  "Toko Bangunan": "toko-bangunan",
  "Toko Mebel": "toko-mebel",
  "Toko HP & Gadget": "toko-hp-gadget",
  "Provider & Telekomunikasi": "provider-telekomunikasi",
  "Toko Elektronik": "toko-elektronik",
  "Pangkas Rambut & Salon": "pangkas-rambut-salon",
  "Studio & Fotografi": "studio-fotografi",
  "Jasa Pengiriman & Logistik": "jasa-pengiriman-logistik",
  "Layanan Pemerintahan": "layanan-pemerintahan",
  "Perkantoran": "perkantoran",
  "Perkantoran Komersial": "perkantoran-komersial",
  "Kawasan Industri": "kawasan-industri",
  "Fasilitas Warga & Balai": "fasilitas-warga-balai",
  "SPBU / Stasiun Pengisian Bahan Bakar": "spbu-stasiun-pengisian-bahan-bakar",
  "Stasiun Kereta Api": "stasiun-kereta-api",
  "Halte / Terminal Bus": "halte-terminal-bus",
  "Transportasi / Stasiun": "transportasi-stasiun",
  "Fasilitas Transit & Shelter": "fasilitas-transit-shelter",
  "Fasilitas Parkir": "fasilitas-parkir",
  "Bengkel & Otomotif": "bengkel-otomotif",
  "Hotel & Penginapan": "hotel-penginapan",
  "Pemakaman": "pemakaman",
  "ATM / Mesin Tunai": "atm-mesin-tunai",
  "Bank & Finansial": "bank-finansial",
  "Lainnya": "lainnya",
};

/**
 * Returns static asset URL for a given POI category
 */
export function getPoiIconUrl(categoryName = "Lainnya") {
  const slug = POI_CATEGORY_ICON_SLUGS[categoryName] || "lainnya";
  return `/assets/icons/poi/${slug}.svg`;
}

/**
 * Maps Open-Meteo WMO weather code to asset URL (Bas Milius 3D Realistic Volumetric SVG)
 */
export function getWeatherIconUrl(wmoCode = 0, isDay = true) {
  const code = Number(wmoCode);
  let slug = isDay ? "clear-day" : "clear-night";

  if (code === 0) {
    slug = isDay ? "clear-day" : "clear-night";
  } else if (code === 1 || code === 2) {
    slug = isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  } else if (code === 3) {
    slug = "overcast";
  } else if (code === 45 || code === 48) {
    slug = "fog";
  } else if (code >= 51 && code <= 57) {
    slug = "drizzle";
  } else if ((code >= 61 && code <= 63) || code === 80) {
    slug = "rain";
  } else if (code >= 64 && code <= 67 || code === 81 || code === 82) {
    slug = "heavy-rain";
  } else if (code === 95 || code === 96) {
    slug = "thunderstorm";
  } else if (code >= 97) {
    slug = "thunderstorm-heavy";
  }

  return `/assets/icons/weather/${slug}.svg`;
}

/**
 * Maps Rider Telemetry Compliance Status to asset URL
 */
export function getRiderIconUrl(status = "COMPLIANT") {
  const statusStr = String(status || "").toUpperCase();
  const map = {
    COMPLIANT: "rider-compliant",
    AVAILABLE: "rider-compliant",
    ACTIVE: "rider-compliant",
    DEVIATED: "rider-deviated",
    OUTSIDE_ZONE: "rider-outside-zone",
    PROHIBITED_ROAD_ALERT: "rider-prohibited-alert",
    OFFLINE: "rider-offline",
    OFF_DUTY: "rider-offline",
    STANDBY: "rider-idle",
    IDLE: "rider-idle",
  };

  const slug = map[statusStr] || "rider-compliant";
  return `/assets/icons/rider/${slug}.svg`;
}

/**
 * Returns static asset URL for Central Hub MOVA
 */
export function getHubIconUrl(variant = "central") {
  return variant === "warehouse" ? "/assets/icons/hub/hub-warehouse.svg" : "/assets/icons/hub/hub-central.svg";
}

// ─────────────────────────────────────────────────────────────
// LEAFLET MAP MARKER FACTORIES
// ─────────────────────────────────────────────────────────────

/**
 * Creates custom Leaflet DivIcon for POIs with 3D Carto Teardrop Pin
 */
export function createPoiMarkerIcon(categoryName = "Lainnya", { size = 32, className = "mova-poi-badge-marker kopigo-poi-badge-marker" } = {}) {
  const iconUrl = getPoiIconUrl(categoryName);
  const height = Math.round(size * (56 / 48));

  return L.divIcon({
    className,
    html: `
      <div style="width: ${size}px; height: ${height}px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s ease;">
        <img src="${iconUrl}" alt="${categoryName}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));" />
      </div>
    `,
    iconSize: [size, height],
    iconAnchor: [size / 2, height - 2],
    popupAnchor: [0, -(height - 4)],
  });
}

/**
 * Creates custom Leaflet DivIcon for Riders with 3D Coffee Delivery Scooter
 */
export function createRiderMarkerIcon(status = "COMPLIANT", { size = 38, label = "", className = "mova-rider-marker kopigo-rider-marker" } = {}) {
  const iconUrl = getRiderIconUrl(status);
  const isDeviated = status === "DEVIATED" || status === "OUTSIDE_ZONE" || status === "PROHIBITED_ROAD_ALERT";
  const pulseColor = isDeviated ? "#EF4444" : "#10B981";

  return L.divIcon({
    className,
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <span style="position: absolute; bottom: 0; width: ${size * 0.8}px; height: ${size * 0.3}px; border-radius: 9999px; background-color: ${pulseColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <img src="${iconUrl}" alt="Rider" style="position: relative; width: ${size}px; height: ${size}px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));" />
        ${label ? `<span style="position: absolute; bottom: -14px; background: rgba(15,23,42,0.85); color: #fff; font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 4px; white-space: nowrap; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${label}</span>` : ""}
      </div>
    `,
    iconSize: [size, size + (label ? 14 : 0)],
    iconAnchor: [size / 2, size * 0.85],
    popupAnchor: [0, -size * 0.85],
  });
}

/**
 * Creates custom Leaflet DivIcon for Central Hub Anchor (3D Architecture)
 */
export function createHubMarkerIcon({ size = 42, label = "Central Hub" } = {}) {
  const iconUrl = getHubIconUrl("central");

  return L.divIcon({
    className: "mova-hub-badge-marker kopigo-hub-badge-marker",
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;">
        <img src="${iconUrl}" alt="${label}" style="width: ${size}px; height: ${size}px; object-fit: contain; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.45));" />
        <span style="background: #1D4ED8; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px; white-space: nowrap; border: 1px solid rgba(255,255,255,0.3); margin-top: -4px; box-shadow: 0 2px 4px rgba(0,0,0,0.35);">
          🏢 ${label}
        </span>
      </div>
    `,
    iconSize: [size, size + 16],
    iconAnchor: [size / 2, size + 16],
    popupAnchor: [0, -(size + 16)],
  });
}
