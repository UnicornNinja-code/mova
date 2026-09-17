/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   High-Definition Visual Badge & Icon Generator for MOVA Single-Tenant
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseIconsDir = path.resolve(__dirname, "../public/assets/icons");

// Ensure subdirectories exist
const dirs = ["poi", "weather", "rider", "hub"];
dirs.forEach((d) => {
  const dirPath = path.join(baseIconsDir, d);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// ─────────────────────────────────────────────────────────────
// 1. 3D CARTO POI PIN GENERATOR (MAPBOX MAKI / FLUENT 3D STYLE)
// ─────────────────────────────────────────────────────────────
function create3dCartoPoiPinSvg({
  primaryColor = "#3B82F6",
  accentColor = "#60A5FA",
  darkColor = "#1D4ED8",
  iconSvg = "",
  label = "",
}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56" fill="none">
  <defs>
    <!-- 3D Pin Gradients -->
    <linearGradient id="pinBodyGrad_${primaryColor.replace('#', '')}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentColor}" />
      <stop offset="45%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="${darkColor}" />
    </linearGradient>

    <!-- Top Specular Gloss Highlight -->
    <linearGradient id="pinGlossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.6" />
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>

    <!-- Inner Disc Bevel Gradient -->
    <linearGradient id="innerDiscGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F1F5F9" />
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="pinGroundBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.5" />
    </filter>
    <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Ground Contact Shadow -->
  <ellipse cx="24" cy="51" rx="13" ry="3.5" fill="#0F172A" opacity="0.28" filter="url(#pinGroundBlur)" />

  <!-- 3D Teardrop Pin Body -->
  <g filter="url(#pinShadow)">
    <path d="M24 3 C13 3 4.5 11.5 4.5 22.5 C4.5 35.5 24 50 24 50 C24 50 43.5 35.5 43.5 22.5 C43.5 11.5 35 3 24 3 Z"
          fill="url(#pinBodyGrad_${primaryColor.replace('#', '')})"
          stroke="#FFFFFF" stroke-opacity="0.3" stroke-width="1.2" />

    <!-- Specular Gloss Arc -->
    <path d="M10 16 C12 8, 17 5, 24 5 C31 5, 36 8, 38 16 C33 11, 15 11, 10 16 Z"
          fill="url(#pinGlossGrad)" />

    <!-- White Inner Recessed Disc -->
    <circle cx="24" cy="22" r="13.5" fill="url(#innerDiscGrad)" stroke="#E2E8F0" stroke-width="1" />
  </g>

  <!-- Icon Graphic (Clean High-Contrast Stroke) -->
  <g transform="translate(14, 12) scale(0.83)" stroke="${darkColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${iconSvg}
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// 2. 3D COFFEE DELIVERY SCOOTER GENERATOR (RIDER TELEMETRY)
// ─────────────────────────────────────────────────────────────
function create3dDeliveryScooterSvg({
  slug = "rider-compliant",
  status = "COMPLIANT",
  glowColor = "#10B981",
  accentColor = "#34D399",
  darkColor = "#047857",
  isPulsing = true,
}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <defs>
    <!-- Body & Box Gradients -->
    <linearGradient id="scooterBodyGrad_${slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentColor}" />
      <stop offset="60%" stop-color="${glowColor}" />
      <stop offset="100%" stop-color="${darkColor}" />
    </linearGradient>
    <linearGradient id="cargoBoxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="50%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="helmetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC" />
      <stop offset="60%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#94A3B8" />
    </linearGradient>
    <linearGradient id="wheelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>

    <!-- Filters -->
    <filter id="groundShadow_${slug}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" />
    </filter>
    <filter id="scooterDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.4" />
    </filter>
    <filter id="beaconGlow_${slug}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Telemetry Ground Radar LED Halo -->
  <ellipse cx="32" cy="54" rx="26" ry="8" fill="${glowColor}" opacity="0.22" filter="url(#groundShadow_${slug})" />
  <ellipse cx="32" cy="54" rx="23" ry="7" stroke="${glowColor}" stroke-width="1.8" stroke-dasharray="4,3" fill="none" opacity="0.85" />
  
  <!-- Ground Wheel Contact Shadows -->
  <ellipse cx="17" cy="53" rx="7" ry="2.5" fill="#0F172A" opacity="0.4" />
  <ellipse cx="47" cy="53" rx="7" ry="2.5" fill="#0F172A" opacity="0.4" />

  <!-- 3D Isometric Delivery Scooter & Rider Group -->
  <g filter="url(#scooterDropShadow)">
    <!-- Back Wheel -->
    <circle cx="17" cy="47" r="7.5" fill="url(#wheelGrad)" stroke="#64748B" stroke-width="1" />
    <circle cx="17" cy="47" r="3.5" fill="#E2E8F0" />

    <!-- Front Wheel -->
    <circle cx="47" cy="47" r="7.5" fill="url(#wheelGrad)" stroke="#64748B" stroke-width="1" />
    <circle cx="47" cy="47" r="3.5" fill="#E2E8F0" />

    <!-- Scooter Chassis & Floorboard -->
    <path d="M19 45 L36 45 L43 38 L45 32 L41 32 L35 40 L24 40 L19 45 Z" fill="#334155" />

    <!-- Fairing Front Body (Colored Status) -->
    <path d="M38 41 L46 30 L49 30 L44 43 L38 41 Z" fill="url(#scooterBodyGrad_${slug})" />
    <!-- Front Mudguard -->
    <path d="M42 43 C42 40 48 40 51 44 L46 45 Z" fill="url(#scooterBodyGrad_${slug})" />
    <!-- Handlebar & Headlight -->
    <path d="M43 27 L46 25 L48 27 L45 29 Z" fill="#64748B" />
    <circle cx="49" cy="30" r="2" fill="#FEF08A" />

    <!-- MOVA Insulated Coffee Cargo Box (Rear Mount) -->
    <g transform="translate(10, 24)">
      <!-- Box Left/Front Face -->
      <polygon points="0,6 14,0 14,16 0,22" fill="url(#cargoBoxGrad)" stroke="#475569" stroke-width="0.75" />
      <!-- Box Right Face -->
      <polygon points="14,0 20,4 20,20 14,16" fill="#0F172A" stroke="#334155" stroke-width="0.75" />
      <!-- Box Top Face -->
      <polygon points="0,6 14,0 20,4 6,10" fill="#334155" stroke="#64748B" stroke-width="0.75" />
      <!-- MOVA Coffee Cup Emblem on Cargo Box -->
      <circle cx="7" cy="11" r="3" fill="${glowColor}" opacity="0.9" />
      <path d="M5.5 10 h3 v2.5 a1.5 1.5 0 0 1 -3 0 Z" fill="#FFFFFF" />
    </g>

    <!-- Rider Torso (Seat Position) -->
    <path d="M26 36 L30 26 L36 27 L33 37 Z" fill="#1E293B" />

    <!-- 3D Rider Helmet with Dark Gloss Visor -->
    <circle cx="34" cy="19" r="6.5" fill="url(#helmetGrad)" stroke="#CBD5E1" stroke-width="0.5" />
    <path d="M35 17 C38 17 40 19 40 21 L35 22 Z" fill="#0F172A" />

    <!-- Top Telemetry Status Beacon Pin -->
    <circle cx="34" cy="9" r="3.5" fill="${glowColor}" filter="url(#beaconGlow_${slug})" stroke="#FFFFFF" stroke-width="0.75" />
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// 3. 3D CENTRAL HUB & WAREHOUSE ARCHITECTURE GENERATOR
// ─────────────────────────────────────────────────────────────
function create3dHubBuildingSvg(variant = "central") {
  if (variant === "warehouse") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="roofGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14B8A6" />
      <stop offset="100%" stop-color="#0F766E" />
    </linearGradient>
    <linearGradient id="wallFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F1F5F9" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>
    <linearGradient id="wallSide" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#94A3B8" />
      <stop offset="100%" stop-color="#64748B" />
    </linearGradient>
    <filter id="hubShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.35" />
    </filter>
  </defs>

  <ellipse cx="32" cy="53" rx="24" ry="7" fill="#0F172A" opacity="0.25" />

  <g filter="url(#hubShadow)">
    <!-- Main Logistics Warehouse Body (Isometric) -->
    <!-- Front Face -->
    <polygon points="12,32 34,22 34,48 12,56" fill="url(#wallFront)" stroke="#94A3B8" stroke-width="0.75" />
    <!-- Side Face -->
    <polygon points="34,22 52,30 52,54 34,48" fill="url(#wallSide)" stroke="#475569" stroke-width="0.75" />
    <!-- Curved Roof Top -->
    <polygon points="12,32 23,16 45,24 34,22" fill="url(#roofGrad)" />
    <polygon points="23,16 45,24 52,30 34,22" fill="#0D9488" />

    <!-- Roller Shutter Dock Doors -->
    <rect x="16" y="39" width="7" height="12" rx="1" fill="#334155" />
    <rect x="25" y="35" width="7" height="12" rx="1" fill="#334155" />
    <!-- Coffee Sack/Box Indicator -->
    <circle cx="43" cy="40" r="3.5" fill="#F59E0B" />
    <text x="43" y="42" font-size="5" font-weight="bold" fill="#FFFFFF" text-anchor="middle">☕</text>
  </g>
</svg>`;
  }

  // Central Hub HQ Skyscraper / Modern Command HQ
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="hqGlassFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#60A5FA" />
      <stop offset="60%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="hqGlassSide" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1E40AF" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>
    <linearGradient id="hqRoof" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#93C5FD" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <filter id="hqShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.38" />
    </filter>
  </defs>

  <!-- Ground Shadow -->
  <ellipse cx="32" cy="54" rx="22" ry="6.5" fill="#0F172A" opacity="0.3" />

  <g filter="url(#hqShadow)">
    <!-- Tower Left/Front Isometric Face -->
    <polygon points="16,22 34,12 34,52 16,58" fill="url(#hqGlassFront)" stroke="#93C5FD" stroke-width="0.75" />
    <!-- Tower Right/Side Isometric Face -->
    <polygon points="34,12 48,20 48,56 34,52" fill="url(#hqGlassSide)" stroke="#1E40AF" stroke-width="0.75" />
    <!-- Tower Roof / Helipad Surface -->
    <polygon points="16,22 34,12 48,20 30,29" fill="url(#hqRoof)" stroke="#DBEAFE" stroke-width="0.75" />

    <!-- Glass Floor Grid Lines -->
    <line x1="16" y1="30" x2="34" y2="21" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="0.8" />
    <line x1="16" y1="39" x2="34" y2="30" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="0.8" />
    <line x1="16" y1="48" x2="34" y2="40" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="0.8" />
    <line x1="34" y1="21" x2="48" y2="28" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="0.8" />
    <line x1="34" y1="30" x2="48" y2="38" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="0.8" />
    <line x1="34" y1="40" x2="48" y2="48" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="0.8" />

    <!-- Antenna Mast & Beacon Beacon -->
    <line x1="34" y1="12" x2="34" y2="4" stroke="#CBD5E1" stroke-width="1.5" />
    <circle cx="34" cy="4" r="2" fill="#EF4444" />
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// 1. 59 POI CATEGORIES DEFINITIONS & ICONS
// ─────────────────────────────────────────────────────────────
const poiCategoriesMap = [
  // Kuliner & Kafe
  { slug: "kafe-kedai-kopi", name: "Kafe & Kedai Kopi", p: "#8B5CF6", a: "#A78BFA", d: "#6D28D9", icon: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line>` },
  { slug: "restoran", name: "Restoran", p: "#EC4899", a: "#F472B6", d: "#BE185D", icon: `<path d="M18 2v20"></path><path d="M6 2v20"></path><path d="M6 6h12"></path><path d="M6 10h12"></path>` },
  { slug: "cepat-saji", name: "Cepat Saji", p: "#F59E0B", a: "#FBBF24", d: "#D97706", icon: `<rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>` },
  { slug: "food-court", name: "Food Court", p: "#F97316", a: "#FB923C", d: "#C2410C", icon: `<circle cx="12" cy="12" r="10"></circle><path d="m10 15 5-3-5-3v6Z"></path>` },
  { slug: "toko-minuman", name: "Toko Minuman", p: "#06B6D4", a: "#22D3EE", d: "#0891B2", icon: `<path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path>` },
  { slug: "toko-roti-kue", name: "Toko Roti & Kue", p: "#D97706", a: "#F59E0B", d: "#B45309", icon: `<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"></path><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"></path><path d="M2 21h20"></path>` },

  // Tempat Ibadah
  { slug: "masjid-mushola", name: "Masjid & Mushola", p: "#10B981", a: "#34D399", d: "#047857", icon: `<path d="M12 2v4"></path><path d="M12 6a7 7 0 0 0-7 7v9h14v-9a7 7 0 0 0-7-7Z"></path><path d="M9 22v-6a3 3 0 0 1 6 0v6"></path>` },
  { slug: "gereja", name: "Gereja", p: "#3B82F6", a: "#60A5FA", d: "#1D4ED8", icon: `<path d="M12 2v8"></path><path d="M8 5h8"></path><path d="M4 22h16v-8l-8-6-8 6v8Z"></path>` },
  { slug: "pura", name: "Pura", p: "#EA580C", a: "#FB923C", d: "#C2410C", icon: `<path d="M12 2 2 12h20L12 2Z"></path><path d="M4 12v10h16V12"></path>` },
  { slug: "vihara", name: "Vihara", p: "#F59E0B", a: "#FCD34D", d: "#B45309", icon: `<path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8Z"></path>` },
  { slug: "tempat-ibadah", name: "Tempat Ibadah", p: "#10B981", a: "#6EE7B7", d: "#059669", icon: `<path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>` },
  { slug: "tempat-ibadah-lainnya", name: "Tempat Ibadah (Lainnya)", p: "#059669", a: "#34D399", d: "#047857", icon: `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>` },

  // Wisata, Seni & Rekreasi
  { slug: "objek-wisata-budaya", name: "Objek Wisata & Budaya", p: "#8B5CF6", a: "#C084FC", d: "#581C87", icon: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"></path>` },
  { slug: "taman-kota-terbuka", name: "Taman Kota / Terbuka", p: "#16A34A", a: "#4ADE80", d: "#15803D", icon: `<path d="M8 18h8"></path><path d="M12 18v4"></path><path d="M12 2a5 5 0 0 0-5 5c0 2.5 2 4.5 4 6 2-1.5 4-3.5 4-6a5 5 0 0 0-3-5Z"></path>` },
  { slug: "taman-ruang-terbuka", name: "Taman & Ruang Terbuka", p: "#22C55E", a: "#86EFAC", d: "#166534", icon: `<circle cx="12" cy="12" r="10"></circle><path d="M8 12s1.5-2 4-2 4 2 4 2"></path>` },
  { slug: "fasilitas-olahraga", name: "Fasilitas Olahraga", p: "#EF4444", a: "#F87171", d: "#B91C1C", icon: `<circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24"></path><path d="m14.83 14.83 4.24 4.24"></path><path d="m14.83 9.17 4.24-4.24"></path><path d="m4.93 19.07 4.24-4.24"></path>` },
  { slug: "kolam-renang-rekreasi-air", name: "Kolam Renang / Rekreasi Air", p: "#0284C7", a: "#38BDF8", d: "#0369A1", icon: `<path d="M2 12h20"></path><path d="M2 17h20"></path><circle cx="12" cy="7" r="3"></circle>` },

  // Kesehatan
  { slug: "rumah-sakit", name: "Rumah Sakit", p: "#DC2626", a: "#EF4444", d: "#991B1B", icon: `<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M12 8v8"></path><path d="M8 12h8"></path>` },
  { slug: "klinik-puskesmas", name: "Klinik & Puskesmas", p: "#E11D48", a: "#FB7185", d: "#9F1239", icon: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>` },
  { slug: "apotek", name: "Apotek", p: "#059669", a: "#34D399", d: "#065F46", icon: `<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M12 8v8"></path><path d="M8 12h8"></path>` },

  // Pendidikan
  { slug: "sekolah-dasar-sd-mi", name: "Sekolah Dasar (SD/MI)", p: "#2563EB", a: "#60A5FA", d: "#1E40AF", icon: `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path>` },
  { slug: "sekolah-menengah-pertama-smp-mts", name: "Sekolah Menengah Pertama (SMP/MTs)", p: "#1D4ED8", a: "#3B82F6", d: "#1E3A8A", icon: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>` },
  { slug: "sekolah-menengah-atas-sma-smk-ma", name: "Sekolah Menengah Atas (SMA/SMK/MA)", p: "#4F46E5", a: "#818CF8", d: "#3730A3", icon: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>` },
  { slug: "taman-kanak-kanak-paud", name: "Taman Kanak-Kanak / PAUD", p: "#F59E0B", a: "#FCD34D", d: "#B45309", icon: `<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>` },
  { slug: "perguruan-tinggi", name: "Perguruan Tinggi", p: "#6366F1", a: "#A5B4FC", d: "#312E81", icon: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>` },
  { slug: "pondok-pesantren", name: "Pondok Pesantren", p: "#0D9488", a: "#2DD4BF", d: "#115E59", icon: `<path d="M12 2v20M2 12h20"></path>` },
  { slug: "sekolah-umum", name: "Sekolah (Umum)", p: "#3B82F6", a: "#93C5FD", d: "#1D4ED8", icon: `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>` },
  { slug: "sekolah-universitas", name: "Sekolah & Universitas", p: "#4338CA", a: "#6366F1", d: "#312E81", icon: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>` },

  // Retail & Perbelanjaan
  { slug: "minimarket", name: "Minimarket", p: "#0EA5E9", a: "#38BDF8", d: "#0369A1", icon: `<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>` },
  { slug: "supermarket", name: "Supermarket", p: "#0284C7", a: "#7DD3FC", d: "#075985", icon: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path>` },
  { slug: "mall-pusat-perbelanjaan", name: "Mall / Pusat Perbelanjaan", p: "#9333EA", a: "#C084FC", d: "#6B21A8", icon: `<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path><path d="M15 3v18"></path>` },
  { slug: "pusat-perbelanjaan", name: "Pusat Perbelanjaan", p: "#A855F7", a: "#D8B4FE", d: "#7E22CE", icon: `<rect x="3" y="3" width="18" height="18" rx="2"></rect>` },
  { slug: "pasar-tradisional", name: "Pasar Tradisional", p: "#D97706", a: "#FBBF24", d: "#92400E", icon: `<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>` },
  { slug: "toko-retail-umum", name: "Toko Retail (Umum)", p: "#64748B", a: "#94A3B8", d: "#334155", icon: `<rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>` },
  { slug: "toko-bangunan", name: "Toko Bangunan", p: "#78716C", a: "#A8A29E", d: "#44403C", icon: `<path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"></path><path d="M17.64 15 22 10.64"></path><path d="m20.91 3.26-1.57-1.57a1.41 1.41 0 0 0-2 0l-4.5 4.5a1.41 1.41 0 0 0 0 2l1.57 1.57a1.41 1.41 0 0 0 2 0l4.5-4.5a1.41 1.41 0 0 0 0-2Z"></path>` },
  { slug: "toko-mebel", name: "Toko Mebel", p: "#B45309", a: "#D97706", d: "#78350F", icon: `<path d="M3 14h18"></path><path d="M4 18v3"></path><path d="M20 18v3"></path><path d="M6 14V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"></path>` },
  { slug: "toko-hp-gadget", name: "Toko HP & Gadget", p: "#2563EB", a: "#60A5FA", d: "#1D4ED8", icon: `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path>` },
  { slug: "provider-telekomunikasi", name: "Provider & Telekomunikasi", p: "#0284C7", a: "#38BDF8", d: "#075985", icon: `<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"></path><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path><path d="M12 2v2"></path><path d="M12 20v2"></path>` },
  { slug: "toko-elektronik", name: "Toko Elektronik", p: "#475569", a: "#64748B", d: "#1E293B", icon: `<rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line>` },
  { slug: "pangkas-rambut-salon", name: "Pangkas Rambut & Salon", p: "#DB2777", a: "#F472B6", d: "#9D174D", icon: `<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>` },
  { slug: "studio-fotografi", name: "Studio & Fotografi", p: "#6366F1", a: "#818CF8", d: "#3730A3", icon: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle>` },
  { slug: "jasa-pengiriman-logistik", name: "Jasa Pengiriman & Logistik", p: "#F97316", a: "#FB923C", d: "#C2410C", icon: `<path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>` },

  // Pemerintahan & Komersial
  { slug: "layanan-pemerintahan", name: "Layanan Pemerintahan", p: "#1E40AF", a: "#3B82F6", d: "#172554", icon: `<path d="M12 2 2 7l10 5 10-5-10-5Z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>` },
  { slug: "perkantoran", name: "Perkantoran", p: "#334155", a: "#64748B", d: "#0F172A", icon: `<rect x="4" y="2" width="16" height="20" rx="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M8 10h.01"></path><path d="M16 10h.01"></path>` },
  { slug: "perkantoran-komersial", name: "Perkantoran Komersial", p: "#1E293B", a: "#475569", d: "#020617", icon: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>` },
  { slug: "kawasan-industri", name: "Kawasan Industri", p: "#475569", a: "#94A3B8", d: "#1E293B", icon: `<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>` },
  { slug: "fasilitas-warga-balai", name: "Fasilitas Warga & Balai", p: "#0D9488", a: "#14B8A6", d: "#115E59", icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>` },

  // Transportasi, SPBU & Utilitas
  { slug: "spbu-stasiun-pengisian-bahan-bakar", name: "SPBU / Stasiun Pengisian Bahan Bakar", p: "#DC2626", a: "#F87171", d: "#991B1B", icon: `<path d="M3 22h12"></path><path d="M4 4h10v18H4z"></path><path d="M14 9h2a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"></path>` },
  { slug: "stasiun-kereta-api", name: "Stasiun Kereta Api", p: "#2563EB", a: "#60A5FA", d: "#1D4ED8", icon: `<rect width="16" height="16" x="4" y="3" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 19-2 3"></path><path d="m18 22-2-3"></path>` },
  { slug: "halte-terminal-bus", name: "Halte / Terminal Bus", p: "#0284C7", a: "#38BDF8", d: "#075985", icon: `<path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>` },
  { slug: "transportasi-stasiun", name: "Transportasi / Stasiun", p: "#0369A1", a: "#0EA5E9", d: "#0C4A6E", icon: `<rect x="3" y="3" width="18" height="18" rx="2"></rect>` },
  { slug: "fasilitas-transit-shelter", name: "Fasilitas Transit & Shelter", p: "#0D9488", a: "#5EEAD4", d: "#134E4A", icon: `<path d="M2 12h20"></path><path d="M20 12v8"></path><path d="M4 12v8"></path>` },
  { slug: "fasilitas-parkir", name: "Fasilitas Parkir", p: "#2563EB", a: "#93C5FD", d: "#1E40AF", icon: `<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path>` },
  { slug: "bengkel-otomotif", name: "Bengkel & Otomotif", p: "#D97706", a: "#FBBF24", d: "#92400E", icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>` },
  { slug: "hotel-penginapan", name: "Hotel & Penginapan", p: "#7C3AED", a: "#A78BFA", d: "#4C1D95", icon: `<path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path>` },
  { slug: "pemakaman", name: "Pemakaman", p: "#64748B", a: "#94A3B8", d: "#334155", icon: `<path d="M12 2v14"></path><path d="M7 7h10"></path><path d="M5 22h14"></path>` },
  { slug: "atm-mesin-tunai", name: "ATM / Mesin Tunai", p: "#059669", a: "#10B981", d: "#047857", icon: `<rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line>` },
  { slug: "bank-finansial", name: "Bank & Finansial", p: "#047857", a: "#34D399", d: "#064E3B", icon: `<path d="M3 21h18"></path><path d="M3 10h18"></path><path d="M5 6l7-3 7 3"></path><path d="M4 10v11"></path><path d="M20 10v11"></path><path d="M8 14v4"></path><path d="M12 14v4"></path><path d="M16 14v4"></path>` },
  { slug: "lainnya", name: "Lainnya", p: "#64748B", a: "#94A3B8", d: "#334155", icon: `<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>` },
];

// ─────────────────────────────────────────────────────────────
// 2. REALISTIC 3D VOLUMETRIC WEATHER ICONS (METEOCONS 3D STYLE)
// ─────────────────────────────────────────────────────────────

function createRealisticWeatherSvg(slug) {
  const commonDefs = `
    <defs>
      <!-- Sun Gradients -->
      <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFFBEB" stop-opacity="0.9" />
        <stop offset="50%" stop-color="#FBBF24" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#F59E0B" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="sunCore" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF08A" />
        <stop offset="35%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#D97706" />
      </linearGradient>
      <linearGradient id="sunRay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FEF08A" />
        <stop offset="100%" stop-color="#F59E0B" />
      </linearGradient>

      <!-- Moon Gradients -->
      <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F8FAFC" />
        <stop offset="50%" stop-color="#E2E8F0" />
        <stop offset="100%" stop-color="#94A3B8" />
      </linearGradient>
      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#E0E7FF" stop-opacity="0.7" />
        <stop offset="70%" stop-color="#818CF8" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#4F46E5" stop-opacity="0" />
      </radialGradient>

      <!-- Cloud Gradients -->
      <linearGradient id="frontCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="65%" stop-color="#F1F5F9" />
        <stop offset="100%" stop-color="#CBD5E1" />
      </linearGradient>
      <linearGradient id="backCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#E2E8F0" />
        <stop offset="100%" stop-color="#94A3B8" />
      </linearGradient>

      <!-- Dark Storm Cloud Gradients -->
      <linearGradient id="stormCloudFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#64748B" />
        <stop offset="60%" stop-color="#475569" />
        <stop offset="100%" stop-color="#1E293B" />
      </linearGradient>
      <linearGradient id="stormCloudBack" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#475569" />
        <stop offset="100%" stop-color="#0F172A" />
      </linearGradient>

      <!-- Rain Droplet Gradient -->
      <linearGradient id="rainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#67E8F9" />
        <stop offset="60%" stop-color="#38BDF8" />
        <stop offset="100%" stop-color="#0284C7" />
      </linearGradient>

      <!-- Lightning Gradient -->
      <linearGradient id="lightningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEF08A" />
        <stop offset="50%" stop-color="#EAB308" />
        <stop offset="100%" stop-color="#CA8A04" />
      </linearGradient>

      <!-- Fog Gradient -->
      <linearGradient id="fogGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E2E8F0" stop-opacity="0" />
        <stop offset="20%" stop-color="#CBD5E1" stop-opacity="0.9" />
        <stop offset="80%" stop-color="#E2E8F0" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#CBD5E1" stop-opacity="0" />
      </linearGradient>

      <!-- Filters -->
      <filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.25" />
      </filter>
      <filter id="sunDropShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#D97706" flood-opacity="0.45" />
      </filter>
      <filter id="boltGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  `;

  let graphic = "";

  switch (slug) {
    case "clear-day":
      graphic = `
        <circle cx="32" cy="32" r="28" fill="url(#sunGlow)" />
        <g filter="url(#sunDropShadow)">
          <path d="M32 4 L32 10" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M32 54 L32 60" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M4 32 L10 32" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M54 32 L60 32" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M12.2 12.2 L16.5 16.5" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M47.5 47.5 L51.8 51.8" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M12.2 51.8 L16.5 47.5" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M47.5 16.5 L51.8 12.2" stroke="url(#sunRay)" stroke-width="3.5" stroke-linecap="round" />
        </g>
        <circle cx="32" cy="32" r="15" fill="url(#sunCore)" filter="url(#sunDropShadow)" />
        <ellipse cx="27" cy="27" rx="6" ry="3.5" transform="rotate(-30 27 27)" fill="#FFFFFF" opacity="0.45" />
      `;
      break;

    case "clear-night":
      graphic = `
        <circle cx="32" cy="32" r="26" fill="url(#moonGlow)" />
        <g fill="#FDE68A" opacity="0.85">
          <circle cx="12" cy="16" r="1.5" />
          <path d="M46 12 L47.5 15 L50.5 16.5 L47.5 18 L46 21 L44.5 18 L41.5 16.5 L44.5 15 Z" />
          <path d="M50 42 L51 44 L53 45 L51 46 L50 48 L49 46 L47 45 L49 44 Z" />
          <circle cx="16" cy="46" r="1.2" />
        </g>
        <path d="M38 12 C24.7 12 14 22.7 14 36 C14 49.3 24.7 60 38 60 C43.2 60 48 58.4 52 55.6 C41.2 54 33 44.8 33 33.6 C33 22.4 41.2 13.2 52 11.6 C48 9.3 43.2 12 38 12 Z" 
              fill="url(#moonGrad)" filter="url(#cloudShadow)" />
        <circle cx="28" cy="34" r="3" fill="#94A3B8" opacity="0.35" />
        <circle cx="24" cy="44" r="2" fill="#94A3B8" opacity="0.35" />
        <circle cx="34" cy="46" r="2.5" fill="#94A3B8" opacity="0.35" />
      `;
      break;

    case "partly-cloudy":
    case "partly-cloudy-day":
      graphic = `
        <g transform="translate(14, -6) scale(0.75)" filter="url(#sunDropShadow)">
          <circle cx="32" cy="32" r="24" fill="url(#sunGlow)" />
          <path d="M32 6 L32 12" stroke="url(#sunRay)" stroke-width="4" stroke-linecap="round" />
          <path d="M52 32 L58 32" stroke="url(#sunRay)" stroke-width="4" stroke-linecap="round" />
          <path d="M46 18 L50 14" stroke="url(#sunRay)" stroke-width="4" stroke-linecap="round" />
          <path d="M46 46 L50 50" stroke="url(#sunRay)" stroke-width="4" stroke-linecap="round" />
          <circle cx="32" cy="32" r="14" fill="url(#sunCore)" />
          <ellipse cx="28" cy="28" rx="5" ry="3" transform="rotate(-30 28 28)" fill="#FFFFFF" opacity="0.45" />
        </g>
        <g filter="url(#cloudShadow)">
          <path d="M19 48 C14 48 10 44 10 39 C10 34.5 13.5 30.8 18 30.2 C19.5 24 25.2 19.5 32 19.5 C39.5 19.5 45.8 25 47 32.2 C51 32.8 54 36.2 54 40.5 C54 45.2 50.2 49 45.5 49 L19 48 Z"
                fill="url(#frontCloudGrad)" />
          <ellipse cx="32" cy="26" rx="9" ry="4.5" fill="#FFFFFF" opacity="0.6" />
          <ellipse cx="20" cy="35" rx="5" ry="3" fill="#FFFFFF" opacity="0.5" />
        </g>
      `;
      break;

    case "partly-cloudy-night":
      graphic = `
        <g transform="translate(14, -4) scale(0.65)">
          <circle cx="32" cy="32" r="24" fill="url(#moonGlow)" />
          <path d="M38 12 C24.7 12 14 22.7 14 36 C14 49.3 24.7 60 38 60 C43.2 60 48 58.4 52 55.6 C41.2 54 33 44.8 33 33.6 C33 22.4 41.2 13.2 52 11.6 C48 9.3 43.2 12 38 12 Z" 
                fill="url(#moonGrad)" />
        </g>
        <g filter="url(#cloudShadow)">
          <path d="M19 48 C14 48 10 44 10 39 C10 34.5 13.5 30.8 18 30.2 C19.5 24 25.2 19.5 32 19.5 C39.5 19.5 45.8 25 47 32.2 C51 32.8 54 36.2 54 40.5 C54 45.2 50.2 49 45.5 49 L19 48 Z"
                fill="url(#frontCloudGrad)" />
          <ellipse cx="32" cy="26" rx="9" ry="4.5" fill="#FFFFFF" opacity="0.6" />
        </g>
      `;
      break;

    case "overcast":
      graphic = `
        <path d="M25 36 C21 36 17.5 32.5 17.5 28.5 C17.5 24.8 20.2 21.8 24 21.2 C25.2 16 30 12 36 12 C42.5 12 48 16.8 49 23 C52.5 23.5 55 26.5 55 30 C55 34 51.8 37 47.8 37 L25 36 Z"
              fill="url(#backCloudGrad)" opacity="0.85" />
        <g filter="url(#cloudShadow)">
          <path d="M16 50 C11 50 7 46 7 41 C7 36.5 10.5 32.8 15 32.2 C16.5 26 22.2 21.5 29 21.5 C36.5 21.5 42.8 27 44 34.2 C48 34.8 51 38.2 51 42.5 C51 47.2 47.2 51 42.5 51 L16 50 Z"
                fill="url(#frontCloudGrad)" />
          <ellipse cx="29" cy="28" rx="8" ry="4" fill="#FFFFFF" opacity="0.6" />
          <ellipse cx="17" cy="37" rx="4.5" ry="2.5" fill="#FFFFFF" opacity="0.45" />
        </g>
      `;
      break;

    case "fog":
      graphic = `
        <g filter="url(#cloudShadow)" opacity="0.9">
          <path d="M18 36 C14 36 10.8 32.8 10.8 28.8 C10.8 25.2 13.6 22.2 17.2 21.8 C18.4 16.8 23 13 28.5 13 C34.5 13 39.5 17.5 40.5 23.2 C43.8 23.8 46.2 26.5 46.2 30 C46.2 33.8 43.2 36.8 39.5 36.8 L18 36 Z"
                fill="url(#frontCloudGrad)" />
        </g>
        <rect x="8" y="40" width="48" height="4.5" rx="2.25" fill="url(#fogGrad)" />
        <rect x="14" y="47" width="38" height="4" rx="2" fill="url(#fogGrad)" />
        <rect x="10" y="53" width="44" height="3.5" rx="1.75" fill="url(#fogGrad)" />
      `;
      break;

    case "drizzle":
      graphic = `
        <g filter="url(#cloudShadow)">
          <path d="M16 38 C11 38 7 34 7 29 C7 24.5 10.5 20.8 15 20.2 C16.5 14 22.2 9.5 29 9.5 C36.5 9.5 42.8 15 44 22.2 C48 22.8 51 26.2 51 30.5 C51 35.2 47.2 39 42.5 39 L16 38 Z"
                fill="url(#frontCloudGrad)" />
          <ellipse cx="29" cy="16" rx="8" ry="4" fill="#FFFFFF" opacity="0.6" />
        </g>
        <g fill="url(#rainGrad)" opacity="0.9">
          <circle cx="18" cy="46" r="2" />
          <circle cx="28" cy="44" r="2" />
          <circle cx="38" cy="47" r="2" />
          <circle cx="23" cy="54" r="1.8" />
          <circle cx="33" cy="53" r="1.8" />
        </g>
      `;
      break;

    case "rain":
      graphic = `
        <g filter="url(#cloudShadow)">
          <path d="M16 36 C11 36 7 32 7 27 C7 22.5 10.5 18.8 15 18.2 C16.5 12 22.2 7.5 29 7.5 C36.5 7.5 42.8 13 44 20.2 C48 20.8 51 24.2 51 28.5 C51 33.2 47.2 37 42.5 37 L16 36 Z"
                fill="url(#frontCloudGrad)" />
          <ellipse cx="29" cy="14" rx="8" ry="4" fill="#FFFFFF" opacity="0.6" />
        </g>
        <g stroke="url(#rainGrad)" stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="42" x2="14" y2="52" />
          <line x1="28" y1="41" x2="24" y2="53" />
          <line x1="38" y1="43" x2="34" y2="54" />
          <line x1="23" y1="53" x2="20" y2="60" />
          <line x1="33" y1="52" x2="30" y2="60" />
        </g>
      `;
      break;

    case "heavy-rain":
      graphic = `
        <g filter="url(#cloudShadow)">
          <path d="M16 35 C11 35 7 31 7 26 C7 21.5 10.5 17.8 15 17.2 C16.5 11 22.2 6.5 29 6.5 C36.5 6.5 42.8 12 44 19.2 C48 19.8 51 23.2 51 27.5 C51 32.2 47.2 36 42.5 36 L16 35 Z"
                fill="url(#stormCloudFront)" />
          <ellipse cx="29" cy="13" rx="8" ry="4" fill="#94A3B8" opacity="0.4" />
        </g>
        <g stroke="url(#rainGrad)" stroke-width="3.5" stroke-linecap="round">
          <line x1="16" y1="40" x2="11" y2="53" />
          <line x1="24" y1="39" x2="19" y2="54" />
          <line x1="32" y1="40" x2="27" y2="54" />
          <line x1="40" y1="41" x2="35" y2="55" />
          <line x1="20" y1="53" x2="16" y2="62" />
          <line x1="29" y1="52" x2="25" y2="62" />
          <line x1="37" y1="53" x2="33" y2="62" />
        </g>
      `;
      break;

    case "thunderstorm":
      graphic = `
        <g filter="url(#cloudShadow)">
          <path d="M16 34 C11 34 7 30 7 25 C7 20.5 10.5 16.8 15 16.2 C16.5 10 22.2 5.5 29 5.5 C36.5 5.5 42.8 11 44 18.2 C48 18.8 51 22.2 51 26.5 C51 31.2 47.2 35 42.5 35 L16 34 Z"
                fill="url(#stormCloudFront)" />
          <ellipse cx="29" cy="12" rx="8" ry="4" fill="#94A3B8" opacity="0.4" />
        </g>
        <g stroke="url(#rainGrad)" stroke-width="2.5" stroke-linecap="round">
          <line x1="14" y1="40" x2="10" y2="48" />
          <line x1="42" y1="40" x2="38" y2="50" />
        </g>
        <polygon points="30,30 22,44 28,44 24,59 38,41 31,41 36,30"
                 fill="url(#lightningGrad)" stroke="#FFFFFF" stroke-width="0.75" filter="url(#boltGlow)" />
      `;
      break;

    case "thunderstorm-heavy":
      graphic = `
        <path d="M23 28 C19 28 15.5 24.5 15.5 20.5 C15.5 16.8 18.2 13.8 22 13.2 C23.2 8 28 4 34 4 C40.5 4 46 8.8 47 15 C50.5 15.5 53 18.5 53 22 C53 26 49.8 29 45.8 29 L23 28 Z"
              fill="url(#stormCloudBack)" opacity="0.9" />
        <g filter="url(#cloudShadow)">
          <path d="M15 34 C10 34 6 30 6 25 C6 20.5 9.5 16.8 14 16.2 C15.5 10 21.2 5.5 28 5.5 C35.5 5.5 41.8 11 43 18.2 C47 18.8 50 22.2 50 26.5 C50 31.2 46.2 35 41.5 35 L15 34 Z"
                fill="url(#stormCloudFront)" />
        </g>
        <g stroke="url(#rainGrad)" stroke-width="3" stroke-linecap="round">
          <line x1="13" y1="39" x2="8" y2="52" />
          <line x1="45" y1="38" x2="40" y2="52" />
        </g>
        <polygon points="31,28 20,44 28,44 23,61 40,40 31,40 37,28"
                 fill="url(#lightningGrad)" stroke="#FFFFFF" stroke-width="1" filter="url(#boltGlow)" />
      `;
      break;

    default:
      graphic = `<circle cx="32" cy="32" r="15" fill="url(#sunCore)" />`;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
    ${commonDefs}
    ${graphic}
  </svg>`;
}

const weatherList = [
  { slug: "clear-day", name: "Cerah (Siang)" },
  { slug: "clear-night", name: "Cerah (Malam)" },
  { slug: "partly-cloudy", name: "Cerah Berawan" },
  { slug: "partly-cloudy-day", name: "Cerah Berawan (Siang)" },
  { slug: "partly-cloudy-night", name: "Cerah Berawan (Malam)" },
  { slug: "overcast", name: "Mendung / Berawan Tebal" },
  { slug: "fog", name: "Kabut" },
  { slug: "drizzle", name: "Gerimis" },
  { slug: "rain", name: "Hujan Sedang" },
  { slug: "heavy-rain", name: "Hujan Lebat" },
  { slug: "thunderstorm", name: "Badai Petir" },
  { slug: "thunderstorm-heavy", name: "Badai Petir Ekstrem" },
];

// ─────────────────────────────────────────────────────────────
// 3. RIDER TELEMETRY ICONS
// ─────────────────────────────────────────────────────────────
const riderMap = [
  { slug: "rider-compliant", name: "Rider Compliant / Active", p: "#10B981", a: "#34D399", d: "#047857", icon: `<circle cx="18.5" cy="17.5" r="3.5"></circle><circle cx="5.5" cy="17.5" r="3.5"></circle><circle cx="15" cy="5" r="1"></circle><path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` },
  { slug: "rider-deviated", name: "Rider Deviated / Warning", p: "#F59E0B", a: "#FCD34D", d: "#B45309", icon: `<circle cx="18.5" cy="17.5" r="3.5"></circle><circle cx="5.5" cy="17.5" r="3.5"></circle><path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` },
  { slug: "rider-outside-zone", name: "Rider Outside Zone", p: "#EF4444", a: "#F87171", d: "#B91C1C", icon: `<circle cx="18.5" cy="17.5" r="3.5"></circle><circle cx="5.5" cy="17.5" r="3.5"></circle><path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` },
  { slug: "rider-prohibited-alert", name: "Rider Prohibited Toll Proximity", p: "#DC2626", a: "#EF4444", d: "#7F1D1D", icon: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>` },
  { slug: "rider-offline", name: "Rider Offline", p: "#64748B", a: "#94A3B8", d: "#334155", icon: `<circle cx="18.5" cy="17.5" r="3.5"></circle><circle cx="5.5" cy="17.5" r="3.5"></circle><path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` },
  { slug: "rider-idle", name: "Rider Standby / Idle", p: "#0284C7", a: "#38BDF8", d: "#075985", icon: `<circle cx="18.5" cy="17.5" r="3.5"></circle><circle cx="5.5" cy="17.5" r="3.5"></circle><path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>` },
];

// ─────────────────────────────────────────────────────────────
// 4. CENTRAL HUB ICONS
// ─────────────────────────────────────────────────────────────
const hubMap = [
  { slug: "hub-central", name: "Central Hub MOVA", p: "#2563EB", a: "#60A5FA", d: "#1E3A8A", icon: `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>` },
  { slug: "hub-warehouse", name: "Warehouse Hub", p: "#0D9488", a: "#2DD4BF", d: "#115E59", icon: `<path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>` },
];

// Write All SVG Assets
console.log("🎨 GENERATING MOVA HIGH-DEFINITION BADGE & ICON ASSETS...\n");

// 1. POI (3D Carto Pins - Maki/Fluent Style)
let poiCount = 0;
poiCategoriesMap.forEach((item) => {
  const svg = create3dCartoPoiPinSvg({ primaryColor: item.p, accentColor: item.a, darkColor: item.d, iconSvg: item.icon, label: item.name });
  fs.writeFileSync(path.join(baseIconsDir, "poi", `${item.slug}.svg`), svg, "utf-8");
  fs.writeFileSync(path.join(baseIconsDir, "poi", `${item.slug}.png`), svg, "utf-8");
  poiCount++;
});
console.log(`✅ [POI] Berhasil membuat ${poiCount} file ikon 3D Carto Pin POI (1-to-1 master kategori).`);

// 2. Weather (Realistic 3D Volumetric SVG)
let weatherCount = 0;
weatherList.forEach((item) => {
  const svg = createRealisticWeatherSvg(item.slug);
  fs.writeFileSync(path.join(baseIconsDir, "weather", `${item.slug}.svg`), svg, "utf-8");
  fs.writeFileSync(path.join(baseIconsDir, "weather", `${item.slug}.png`), svg, "utf-8");
  weatherCount++;
});
console.log(`✅ [WEATHER] Berhasil membuat ${weatherCount} file ikon Cuaca 3D Realistis (Meteocons Volumetric).`);

// 3. Rider (3D Coffee Delivery Scooter)
let riderCount = 0;
riderMap.forEach((item) => {
  const svg = create3dDeliveryScooterSvg({
    slug: item.slug,
    status: item.name,
    glowColor: item.p,
    accentColor: item.a,
    darkColor: item.d,
  });
  fs.writeFileSync(path.join(baseIconsDir, "rider", `${item.slug}.svg`), svg, "utf-8");
  fs.writeFileSync(path.join(baseIconsDir, "rider", `${item.slug}.png`), svg, "utf-8");
  riderCount++;
});
console.log(`✅ [RIDER] Berhasil membuat ${riderCount} file ikon 3D Delivery Scooter Status Rider.`);

// 4. Hub (3D Headquarters & Warehouse Architecture)
let hubCount = 0;
hubMap.forEach((item) => {
  const svg = create3dHubBuildingSvg(item.slug.replace("hub-", ""));
  fs.writeFileSync(path.join(baseIconsDir, "hub", `${item.slug}.svg`), svg, "utf-8");
  fs.writeFileSync(path.join(baseIconsDir, "hub", `${item.slug}.png`), svg, "utf-8");
  hubCount++;
});
console.log(`✅ [HUB] Berhasil membuat ${hubCount} file ikon 3D Architecture Central Hub.`);

console.log("\n🎉 SELURUH ASSET IKON STATIS BERHASIL DISIAPKAN!");
