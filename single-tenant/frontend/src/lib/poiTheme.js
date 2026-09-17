import L from "leaflet";

/**
 * Authentic Boxicons POI Classification & Visual System
 * Features contextually accurate Boxicons icons and distinct vibrant color palettes per category.
 */

// 1. Core Category Groups with Distinct Colors and Authentic Boxicons
export const POI_CATEGORY_GROUPS = [
  {
    id: "cafe_coffee",
    groupName: "Kafe & Kedai Kopi",
    color: "#EA580C", // Warm Roasted Amber
    bgLight: "#FFF7ED",
    borderColor: "#FDBA74",
    boxicon: "bx-coffee",
    categories: ["Kafe & Kedai Kopi", "cafe", "coffee_shop", "kopi", "coffee"],
    description: "Titik utama penikmat kopi & nongkrong (Potensi penjualan tertinggi pagi & sore)",
    timePeak: "Pagi & Sore",
  },
  {
    id: "restaurant_food",
    groupName: "Restoran & Rumah Makan",
    color: "#DC2626", // Crimson Food Red
    bgLight: "#FEF2F2",
    borderColor: "#FECACA",
    boxicon: "bx-dish",
    categories: ["Restoran", "restaurant", "warung", "rumah makan"],
    description: "Sentra kuliner & santap siang dengan arus pejalan kaki stabil",
    timePeak: "Siang & Malam",
  },
  {
    id: "fastfood_foodcourt",
    groupName: "Cepat Saji & Food Court",
    color: "#F97316", // Flame Orange
    bgLight: "#FFF7ED",
    borderColor: "#FFEDD5",
    boxicon: "bx-food-menu",
    categories: ["Cepat Saji", "Food Court", "fast_food", "food_court"],
    description: "Pusat jajanan siap saji & pujasera dengan perputaran pelanggan cepat",
    timePeak: "Siang & Malam",
  },
  {
    id: "bakery_pastry",
    groupName: "Toko Roti & Pastry",
    color: "#DB2777", // Pastry Berry Pink
    bgLight: "#FDF2F8",
    borderColor: "#FBCFE8",
    boxicon: "bx-cake-slice",
    categories: ["Toko Roti & Kue", "bakery", "cake", "kue", "pastry"],
    description: "Outlet roti, cake & kudapan manis pendamping kopi",
    timePeak: "Pagi & Sore",
  },
  {
    id: "beverage_kiosk",
    groupName: "Toko Minuman & Es",
    color: "#D97706", // Beverage Amber
    bgLight: "#FEF3C7",
    borderColor: "#FDE68A",
    boxicon: "bx-cupcake",
    categories: ["Toko Minuman", "beverages", "drink", "bubble_tea"],
    description: "Kios minuman segar, jus & es olahan di pinggir jalan",
    timePeak: "Siang",
  },
  {
    id: "minimarket",
    groupName: "Minimarket & Swalayan",
    color: "#2563EB", // Retail Cobalt Blue
    bgLight: "#EFF6FF",
    borderColor: "#93C5FD",
    boxicon: "bx-cart",
    categories: ["Minimarket", "Supermarket", "convenience", "supermarket", "indomaret", "alfamart"],
    description: "Titik transit belanja harian dengan parkiran terbuka strategis",
    timePeak: "Pagi, Siang & Malam",
  },
  {
    id: "mall_shopping",
    groupName: "Mall & Pusat Belanja",
    color: "#7C3AED", // Royal Violet
    bgLight: "#F5F3FF",
    borderColor: "#DDD6FE",
    boxicon: "bx-buildings",
    categories: ["Mall / Pusat Perbelanjaan", "Pusat Perbelanjaan", "mall", "department_store"],
    description: "Pusat gaya hidup, perbelanjaan modern & crowd padat",
    timePeak: "Sore & Malam",
  },
  {
    id: "traditional_market",
    groupName: "Pasar Tradisional",
    color: "#C2410C", // Terracotta Rust
    bgLight: "#FFF7ED",
    borderColor: "#FED7AA",
    boxicon: "bx-store-alt",
    categories: ["Pasar Tradisional", "marketplace", "market", "pasar"],
    description: "Pusat perdagangan rakyat dengan konsentrasi massa sangat tinggi di pagi hari",
    timePeak: "Pagi (05:00 - 10:00)",
  },
  {
    id: "retail_shop",
    groupName: "Toko Retail & Busana",
    color: "#4F46E5", // Indigo Retail
    bgLight: "#EEF2FF",
    borderColor: "#C7D2FE",
    boxicon: "bx-shopping-bag",
    categories: ["Toko Retail (Umum)", "Toko Mebel", "clothes", "fashion", "shop", "store"],
    description: "Pertokoan kebutuhan harian, busana & perabot",
    timePeak: "Siang & Sore",
  },
  {
    id: "hardware_tools",
    groupName: "Toko Bangunan & Bengkel",
    color: "#92400E", // Industrial Bronze
    bgLight: "#FFFBEB",
    borderColor: "#FDE68A",
    boxicon: "bx-cog",
    categories: ["Toko Bangunan", "Bengkel & Otomotif", "hardware", "repair", "bengkel"],
    description: "Pusat servis kendaraan, toko material & ruang tunggu pengemudi",
    timePeak: "Pagi & Siang",
  },
  {
    id: "gadget_electronics",
    groupName: "Elektronik & Gadget",
    color: "#0891B2", // Tech Cyan
    bgLight: "#ECFEFF",
    borderColor: "#A5F3FC",
    boxicon: "bx-mobile",
    categories: ["Toko HP & Gadget", "Provider & Telekomunikasi", "Toko Elektronik", "electronics", "mobile_phone"],
    description: "Gerai konter pulsa, servis smartphone & perangkat elektronik",
    timePeak: "Siang & Sore",
  },
  {
    id: "primary_education",
    groupName: "Sekolah Dasar & PAUD",
    color: "#0284C7", // Sky Education
    bgLight: "#F0F9FF",
    borderColor: "#BAE6FD",
    boxicon: "bx-book-open",
    categories: ["Sekolah Dasar (SD/MI)", "Taman Kanak-Kanak / PAUD", "kindergarten", "primary_school"],
    description: "Area antar-jemput murid & orang tua aktif",
    timePeak: "Pagi (06:30 - 11:30)",
  },
  {
    id: "secondary_education",
    groupName: "Sekolah Menengah (SMP/SMA)",
    color: "#3B82F6", // Academic Blue
    bgLight: "#EFF6FF",
    borderColor: "#93C5FD",
    boxicon: "bx-book",
    categories: ["Sekolah Menengah Pertama (SMP/MTs)", "Sekolah Menengah Atas (SMA/SMK/MA)", "Sekolah (Umum)", "school"],
    description: "Komunitas pelajar remaja aktif saat jam masuk dan pulang sekolah",
    timePeak: "Pagi & Siang",
  },
  {
    id: "higher_education",
    groupName: "Perguruan Tinggi & Kampus",
    color: "#581C87", // Deep University Purple
    bgLight: "#FAF5FF",
    borderColor: "#E9D5FF",
    boxicon: "bx-book-bookmark",
    categories: ["Perguruan Tinggi", "Sekolah & Universitas", "Pondok Pesantren", "university", "college"],
    description: "Sentra mahasiswa & civitas akademika dengan jam santai fleksibel",
    timePeak: "Siang, Sore & Malam",
  },
  {
    id: "hospital_medical",
    groupName: "Rumah Sakit & Darurat",
    color: "#B91C1C", // Hospital Red
    bgLight: "#FEF2F2",
    borderColor: "#FCA5A5",
    boxicon: "bx-building-hospital",
    categories: ["Rumah Sakit", "hospital"],
    description: "Layanan medis 24 jam dengan arus dokter, perawat & penunggu pasien",
    timePeak: "24 Jam Nonstop",
  },
  {
    id: "clinic_pharmacy",
    groupName: "Klinik & Apotek",
    color: "#059669", // Medical Mint Green
    bgLight: "#ECFDF5",
    borderColor: "#6EE7B7",
    boxicon: "bx-capsule",
    categories: ["Apotek", "Klinik & Puskesmas", "pharmacy", "clinic", "doctors"],
    description: "Fasilitas kesehatan primer & akses obat-obatan masyarakat",
    timePeak: "Pagi, Siang & Malam",
  },
  {
    id: "mosque_worship",
    groupName: "Masjid & Mushola",
    color: "#16A34A", // Islamic Green
    bgLight: "#F0FDF4",
    borderColor: "#86EFAC",
    boxicon: "bx-mosque",
    categories: ["Masjid & Mushola", "mosque", "mushola"],
    description: "Tempat ibadah utama umat Islam (Puncak crowd saat shalat 5 waktu & Shalat Jumat)",
    timePeak: "Subuh, Dzuhur, Ashar, Maghrib, Isya",
  },
  {
    id: "church_worship",
    groupName: "Gereja & Rumah Ibadah",
    color: "#0284C7", // Azure Worship
    bgLight: "#F0F9FF",
    borderColor: "#7DD3FC",
    boxicon: "bx-church",
    categories: ["Gereja", "church"],
    description: "Pusat ibadah jemaat kebaktian mingguan dan kegiatan sosial gereja",
    timePeak: "Minggu & Hari Raya",
  },
  {
    id: "other_worship",
    groupName: "Pura, Vihara & Lainnya",
    color: "#B45309", // Saffron Ochre
    bgLight: "#FFFBEB",
    borderColor: "#FCD34D",
    boxicon: "bx-temple",
    categories: ["Pura", "Vihara", "Tempat Ibadah (Lainnya)", "Tempat Ibadah", "temple", "shrine"],
    description: "Sarana peribadatan keagamaan umat Hindu, Buddha & Konghucu",
    timePeak: "Hari Keagamaan",
  },
  {
    id: "train_station",
    groupName: "Stasiun Kereta Api",
    color: "#334155", // Locomotive Slate
    bgLight: "#F8FAFC",
    borderColor: "#CBD5E1",
    boxicon: "bx-train",
    categories: ["Stasiun Kereta Api", "station", "train_station"],
    description: "Hub transit komuter antar-kota volume tinggi dengan flow penumpang masif",
    timePeak: "Pagi & Sore",
  },
  {
    id: "bus_transit",
    groupName: "Halte & Terminal Bus",
    color: "#0284C7", // Transit Sky Blue
    bgLight: "#F0F9FF",
    borderColor: "#7DD3FC",
    boxicon: "bx-bus",
    categories: ["Halte / Terminal Bus", "Fasilitas Transit & Shelter", "Transportasi / Stasiun", "bus_station", "halt"],
    description: "Pemberhentian angkutan umum, shelter feeder & ruang tunggu penumpang",
    timePeak: "Pagi & Sore",
  },
  {
    id: "fuel_gas",
    groupName: "SPBU & Energi",
    color: "#FF5722", // Energy Orange-Red
    bgLight: "#FBE9E7",
    borderColor: "#FFCCBC",
    boxicon: "bx-station",
    categories: ["SPBU / Stasiun Pengisian Bahan Bakar", "fuel", "gas_station"],
    description: "Stasiun pengisian bahan bakar & rest stop pengemudi",
    timePeak: "Pagi, Siang & Sore",
  },
  {
    id: "bank_finance",
    groupName: "Bank & Lembaga Keuangan",
    color: "#065F46", // Deep Banker Emerald
    bgLight: "#ECFDF5",
    borderColor: "#6EE7B7",
    boxicon: "bx-bank",
    categories: ["Bank & Finansial", "bank"],
    description: "Kantor cabang bank, lembaga keuangan & sentra transaksi bisnis",
    timePeak: "Pagi & Siang (Jam Operasional Bank)",
  },
  {
    id: "atm_cash",
    groupName: "ATM / Galeri Tunai",
    color: "#0D9488", // Teal ATM
    bgLight: "#F0FDFA",
    borderColor: "#5EEAD4",
    boxicon: "bx-credit-card",
    categories: ["ATM / Mesin Tunai", "atm"],
    description: "Penarikan uang tunai cepat 24 jam di jalur strategis",
    timePeak: "24 Jam",
  },
  {
    id: "park_nature",
    groupName: "Taman & Ruang Hijau",
    color: "#10B981", // Meadow Green
    bgLight: "#ECFDF5",
    borderColor: "#A7F3D0",
    boxicon: "bx-tree",
    categories: ["Taman Kota / Terbuka", "Taman & Ruang Terbuka", "park", "garden", "alun-alun"],
    description: "Alun-alun & taman rekreasi keluarga (Ramai sore & akhir pekan)",
    timePeak: "Sore & Akhir Pekan",
  },
  {
    id: "sports_stadium",
    groupName: "Fasilitas Olahraga & GOR",
    color: "#84CC16", // Lime Sport
    bgLight: "#F7FEE7",
    borderColor: "#BEF264",
    boxicon: "bx-football",
    categories: ["Fasilitas Olahraga", "stadium", "sports_centre", "pitch", "gor"],
    description: "Gelanggang olahraga, lapangan futsal/bulutangkis & arena komunitas",
    timePeak: "Pagi & Sore",
  },
  {
    id: "swimming_water",
    groupName: "Kolam Renang & Wisata Air",
    color: "#06B6D4", // Water Blue
    bgLight: "#ECFEFF",
    borderColor: "#67E8F9",
    boxicon: "bx-swimming-pool",
    categories: ["Kolam Renang / Rekreasi Air", "swimming_pool", "water_park"],
    description: "Wahana rekreasi air & arena berenang akhir pekan",
    timePeak: "Pagi & Sore",
  },
  {
    id: "office_business",
    groupName: "Perkantoran Komersial",
    color: "#1E293B", // Corporate Dark Slate
    bgLight: "#F8FAFC",
    borderColor: "#CBD5E1",
    boxicon: "bx-briefcase",
    categories: ["Perkantoran Komersial", "Perkantoran", "Kawasan Industri", "office", "commercial", "industrial"],
    description: "Kawasan kantor profesional & sentra bisnis perkotaan",
    timePeak: "Siang (Break Time)",
  },
  {
    id: "hotel_lodging",
    groupName: "Hotel & Penginapan",
    color: "#9333EA", // Hospitality Violet
    bgLight: "#FAF5FF",
    borderColor: "#D8B4FE",
    boxicon: "bx-building",
    categories: ["Hotel & Penginapan", "hotel", "guest_house"],
    description: "Akomodasi wisatawan & tamu perjalanan dinas",
    timePeak: "Pagi & Malam",
  },
  {
    id: "logistics_courier",
    groupName: "Logistik & Ekspedisi",
    color: "#D97706", // Courier Amber
    bgLight: "#FFFBEB",
    borderColor: "#FCD34D",
    boxicon: "bx-package",
    categories: ["Jasa Pengiriman & Logistik", "courier", "post_office", "logistics"],
    description: "Hub drop point kurir & pengiriman paket ekspres",
    timePeak: "Siang & Sore",
  },
  {
    id: "salon_barber",
    groupName: "Pangkas Rambut & Salon",
    color: "#BE185D", // Salon Magenta
    bgLight: "#FDF2F8",
    borderColor: "#F472B6",
    boxicon: "bx-cut",
    categories: ["Pangkas Rambut & Salon", "barber", "hairdresser", "salon"],
    description: "Layanan pangkas rambut pria/wanita & ruang tunggu",
    timePeak: "Sore & Malam",
  },
  {
    id: "studio_photo",
    groupName: "Studio & Fotografi",
    color: "#8B5CF6", // Creative Purple
    bgLight: "#F5F3FF",
    borderColor: "#C4B5FD",
    boxicon: "bx-camera",
    categories: ["Studio & Fotografi", "photo_studio", "photography"],
    description: "Studio foto wisuda, pasfoto & pembuatan konten kreatif",
    timePeak: "Siang & Sore",
  },
  {
    id: "civic_community",
    groupName: "Balai Warga & Pelayanan",
    color: "#475569", // Civic Slate
    bgLight: "#F8FAFC",
    borderColor: "#CBD5E1",
    boxicon: "bx-building-house",
    categories: ["Layanan Pemerintahan", "Fasilitas Warga & Balai", "townhall", "community_centre", "government"],
    description: "Kantor kelurahan/desa & balai pertemuan masyarakat",
    timePeak: "Pagi & Siang",
  },
  {
    id: "parking_facility",
    groupName: "Fasilitas Parkir",
    color: "#64748B", // Parking Gray
    bgLight: "#F1F5F9",
    borderColor: "#CBD5E1",
    boxicon: "bx-car",
    categories: ["Fasilitas Parkir", "parking"],
    description: "Area parkir terpusat & rest stop kendaraan bermotor",
    timePeak: "Siang & Malam",
  },
];

/**
 * Resolve Theme, Boxicon name, and Colors for any POI category string
 */
export function getPoiCategoryTheme(categoryName = "") {
  const raw = String(categoryName || "").trim();
  const norm = raw.toLowerCase();

  // Find exact or substring match among POI_CATEGORY_GROUPS
  for (const group of POI_CATEGORY_GROUPS) {
    for (const cat of group.categories) {
      const catNorm = cat.toLowerCase();
      if (norm === catNorm || norm.includes(catNorm) || catNorm.includes(norm)) {
        return {
          group: group.id,
          groupName: group.groupName,
          color: group.color,
          bgLight: group.bgLight,
          borderColor: group.borderColor,
          boxicon: group.boxicon,
          label: raw || group.groupName,
          description: group.description,
          timePeak: group.timePeak,
        };
      }
    }
  }

  // Fallback for uncategorized / general POI
  return {
    group: "other",
    groupName: "Fasilitas Umum",
    color: "#64748B",
    bgLight: "#F1F5F9",
    borderColor: "#CBD5E1",
    boxicon: "bx-map",
    label: raw || "Fasilitas Umum",
    description: "Titik fasilitas umum tambahan",
    timePeak: "Fleksibel",
  };
}

/**
 * Creates Google Maps Style Custom Leaflet DivIcon for a POI using authentic Boxicons
 */
export function createGoogleMapsPoiIcon(poi, isSelected = false) {
  const theme = getPoiCategoryTheme(poi.category || poi.category_name);
  const size = isSelected ? 30 : 24;
  const iconSize = isSelected ? 15 : 12;

  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      background-color: ${theme.color};
      border-radius: 50%;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      cursor: pointer;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s ease;
      ${isSelected ? 'transform: scale(1.25); z-index: 1000; box-shadow: 0 0 0 3px rgba(37,99,235,0.4), 0 4px 12px rgba(0,0,0,0.35);' : ''}
    " class="mova-poi-pin" data-poi-id="${poi.id || ''}">
      <i class="bx ${theme.boxicon}" style="font-size: ${iconSize}px; line-height: 1; color: #FFFFFF; display: block;"></i>
      <div style="
        position: absolute;
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 3.5px solid transparent;
        border-right: 3.5px solid transparent;
        border-top: 4.5px solid ${theme.color};
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "mova-google-poi-marker",
    iconSize: [size, size + 4],
    iconAnchor: [size / 2, size + 4],
    popupAnchor: [0, -(size + 4)],
  });
}
