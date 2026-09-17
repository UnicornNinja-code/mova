import L from "leaflet";

/**
 * Centralized Category Visual Mapping for POI Markers
 */
export const POI_CATEGORY_CONFIG = {
  Pendidikan: {
    key: "Pendidikan",
    label: "Pendidikan / Sekolah",
    color: "#0284C7", // Sky Blue
    bgClass: "bg-sky-600",
    textClass: "text-sky-600",
    iconSymbol: "🎓",
  },
  Kampus: {
    key: "Kampus",
    label: "Kampus / Universitas",
    color: "#4F46E5", // Indigo
    bgClass: "bg-indigo-600",
    textClass: "text-indigo-600",
    iconSymbol: "🏛️",
  },
  Perkantoran: {
    key: "Perkantoran",
    label: "Perkantoran & Finansial",
    color: "#475569", // Slate
    bgClass: "bg-slate-600",
    textClass: "text-slate-600",
    iconSymbol: "🏢",
  },
  Industri: {
    key: "Industri",
    label: "Pabrik / Industri",
    color: "#D97706", // Amber
    bgClass: "bg-amber-600",
    textClass: "text-amber-600",
    iconSymbol: "🏭",
  },
  Taman: {
    key: "Taman",
    label: "Taman & Ruang Publik",
    color: "#059669", // Emerald
    bgClass: "bg-emerald-600",
    textClass: "text-emerald-600",
    iconSymbol: "🌳",
  },
  Komersial: {
    key: "Komersial",
    label: "Ritel & Komersial",
    color: "#E11D48", // Rose
    bgClass: "bg-rose-600",
    textClass: "text-rose-600",
    iconSymbol: "🏪",
  },
  Kuliner: {
    key: "Kuliner",
    label: "Kuliner & Kafe",
    color: "#EA580C", // Orange
    bgClass: "bg-orange-600",
    textClass: "text-orange-600",
    iconSymbol: "☕",
  },
  Transportasi: {
    key: "Transportasi",
    label: "Transportasi & Transit",
    color: "#7C3AED", // Violet
    bgClass: "bg-violet-600",
    textClass: "text-violet-600",
    iconSymbol: "🚉",
  },
  Fasilitas: {
    key: "Fasilitas",
    label: "Fasilitas Publik & Kesehatan",
    color: "#0891B2", // Cyan
    bgClass: "bg-cyan-600",
    textClass: "text-cyan-600",
    iconSymbol: "🏥",
  },
  Lainnya: {
    key: "Lainnya",
    label: "Lainnya (Unclassified)",
    color: "#52525B", // Zinc
    bgClass: "bg-zinc-600",
    textClass: "text-zinc-600",
    iconSymbol: "📍",
  },
};

/**
 * Explicit Dictionary Mapping: All 50 Database Raw Categories ➔ Frontend UI Visual Groups
 */
export const RAW_CATEGORY_TO_UI_GROUP = {
  // Pendidikan (6 Categories)
  "Sekolah Dasar (SD/MI)": "Pendidikan",
  "Sekolah Menengah Pertama (SMP/MTs)": "Pendidikan",
  "Sekolah Menengah Atas (SMA/SMK/MA)": "Pendidikan",
  "Sekolah (Umum)": "Pendidikan",
  "Taman Kanak-Kanak / PAUD": "Pendidikan",
  "Pondok Pesantren": "Pendidikan",

  // Kampus (1 Category)
  "Perguruan Tinggi": "Kampus",

  // Perkantoran & Finansial (5 Categories)
  "Layanan Pemerintahan": "Perkantoran",
  "Perkantoran Komersial": "Perkantoran",
  "Bank & Finansial": "Perkantoran",
  "ATM / Mesin Tunai": "Perkantoran",
  "Provider & Telekomunikasi": "Perkantoran",

  // Taman & Ruang Publik (3 Categories)
  "Taman Kota / Terbuka": "Taman",
  "Fasilitas Olahraga": "Taman",
  "Kolam Renang / Rekreasi Air": "Taman",

  // Komersial & Ritel (12 Categories)
  "Minimarket": "Komersial",
  "Toko Retail (Umum)": "Komersial",
  "Supermarket": "Komersial",
  "Pasar Tradisional": "Komersial",
  "Mall / Pusat Perbelanjaan": "Komersial",
  "Toko Bangunan": "Komersial",
  "Toko Elektronik": "Komersial",
  "Toko Mebel": "Komersial",
  "Toko HP & Gadget": "Komersial",
  "Pangkas Rambut & Salon": "Komersial",
  "Studio & Fotografi": "Komersial",
  "Toko Roti & Kue": "Kuliner",

  // Kuliner & Kafe (5 Categories)
  "Restoran": "Kuliner",
  "Cepat Saji": "Kuliner",
  "Kafe & Kedai Kopi": "Kuliner",
  "Food Court": "Kuliner",
  "Toko Minuman": "Kuliner",

  // Transportasi (6 Categories)
  "Fasilitas Parkir": "Transportasi",
  "SPBU / Stasiun Pengisian Bahan Bakar": "Transportasi",
  "Halte / Terminal Bus": "Transportasi",
  "Fasilitas Transit & Shelter": "Transportasi",
  "Stasiun Kereta Api": "Transportasi",
  "Jasa Pengiriman & Logistik": "Transportasi",

  // Fasilitas Publik, Ibadah & Kesehatan (11 Categories)
  "Masjid & Mushola": "Fasilitas",
  "Gereja": "Fasilitas",
  "Pura": "Fasilitas",
  "Tempat Ibadah (Lainnya)": "Fasilitas",
  "Rumah Sakit": "Fasilitas",
  "Apotek": "Fasilitas",
  "Klinik & Puskesmas": "Fasilitas",
  "Hotel & Penginapan": "Fasilitas",
  "Pemakaman": "Fasilitas",
  "Fasilitas Warga & Balai": "Fasilitas",
  "Bengkel & Otomotif": "Fasilitas",

  // Genuine Miscellaneous (1 Category - Exactly 25 DB Records)
  "Lainnya": "Lainnya",
};

/**
 * Helper to get normalized category config for any POI raw category string
 */
export function getCategoryConfig(categoryStr) {
  if (!categoryStr) return POI_CATEGORY_CONFIG.Lainnya;

  const rawTrimmed = String(categoryStr).trim();

  // 1. Direct explicit mapping check
  if (RAW_CATEGORY_TO_UI_GROUP[rawTrimmed]) {
    const groupKey = RAW_CATEGORY_TO_UI_GROUP[rawTrimmed];
    return POI_CATEGORY_CONFIG[groupKey] || POI_CATEGORY_CONFIG.Lainnya;
  }

  // 2. Substring fallback matching for unexpected raw strings
  const catLower = rawTrimmed.toLowerCase();
  if (catLower.includes("kampus") || catLower.includes("univ") || catLower.includes("perguruan tinggi")) return POI_CATEGORY_CONFIG.Kampus;
  if (catLower.includes("didik") || catLower.includes("sekolah") || catLower.includes("edu") || catLower.includes("pesantren")) return POI_CATEGORY_CONFIG.Pendidikan;
  if (catLower.includes("kantor") || catLower.includes("office") || catLower.includes("bisnis") || catLower.includes("pemerintah") || catLower.includes("bank") || catLower.includes("atm")) return POI_CATEGORY_CONFIG.Perkantoran;
  if (catLower.includes("pabrik") || catLower.includes("industri") || catLower.includes("gudang")) return POI_CATEGORY_CONFIG.Industri;
  if (catLower.includes("taman") || catLower.includes("park") || catLower.includes("publik") || catLower.includes("olahraga") || catLower.includes("renang")) return POI_CATEGORY_CONFIG.Taman;
  if (catLower.includes("pasar") || catLower.includes("mall") || catLower.includes("swalayan") || catLower.includes("komersial") || catLower.includes("toko") || catLower.includes("minimarket") || catLower.includes("retail") || catLower.includes("supermarket")) return POI_CATEGORY_CONFIG.Komersial;
  if (catLower.includes("kafe") || catLower.includes("cafe") || catLower.includes("resto") || catLower.includes("makan") || catLower.includes("kuliner") || catLower.includes("cepat saji") || catLower.includes("roti") || catLower.includes("minuman")) return POI_CATEGORY_CONFIG.Kuliner;
  if (catLower.includes("stasiun") || catLower.includes("terminal") || catLower.includes("bandara") || catLower.includes("transport") || catLower.includes("parkir") || catLower.includes("spbu") || catLower.includes("logistik")) return POI_CATEGORY_CONFIG.Transportasi;
  if (catLower.includes("rs") || catLower.includes("sehat") || catLower.includes("ibadah") || catLower.includes("masjid") || catLower.includes("gereja") || catLower.includes("pura") || catLower.includes("fasilitas") || catLower.includes("sakit") || catLower.includes("klinik") || catLower.includes("apotek") || catLower.includes("hotel") || catLower.includes("pemakaman") || catLower.includes("bengkel")) return POI_CATEGORY_CONFIG.Fasilitas;

  // 3. Fallback for unclassified
  return POI_CATEGORY_CONFIG.Lainnya;
}

/**
 * Custom Leaflet divIcon marker generator per POI category
 */
export function createCategoryLeafletIcon(categoryStr, paneName = "poiPane") {
  const config = getCategoryConfig(categoryStr);
  const size = 14;

  const html = `
    <div style="
      background-color: ${config.color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 1.5px solid #FFFFFF;
      box-shadow: 0 1px 3px rgba(0,0,0,0.35);
    "></div>
  `;

  return L.divIcon({
    html,
    className: "custom-poi-dot-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    pane: paneName,
  });
}
