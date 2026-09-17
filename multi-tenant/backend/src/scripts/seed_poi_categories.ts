/*
 * seed_poi_categories.ts
 * Synchronizes all 51 POI categories from POIClusterer into poi_categories table with Likert 1-5 time scores.
 */

import { pool } from "../config/database.js";

const allCategories = [
  { name: "Hotel & Penginapan", pagi: 3, siang: 2, sore: 3, malam: 4 },
  { name: "Kafe & Kedai Kopi", pagi: 2, siang: 3, sore: 5, malam: 5 },
  { name: "Cepat Saji", pagi: 2, siang: 4, sore: 4, malam: 5 },
  { name: "Food Court", pagi: 2, siang: 5, sore: 4, malam: 5 },
  { name: "Restoran", pagi: 2, siang: 5, sore: 3, malam: 5 },
  { name: "Toko Minuman", pagi: 2, siang: 4, sore: 5, malam: 4 },
  { name: "Toko Roti & Kue", pagi: 3, siang: 3, sore: 4, malam: 3 },
  { name: "Minimarket", pagi: 3, siang: 4, sore: 4, malam: 4 },
  { name: "Supermarket", pagi: 2, siang: 4, sore: 4, malam: 4 },
  { name: "Mall / Pusat Perbelanjaan", pagi: 2, siang: 4, sore: 5, malam: 5 },
  { name: "Pasar Tradisional", pagi: 5, siang: 4, sore: 2, malam: 1 },
  { name: "Perkantoran Komersial", pagi: 4, siang: 5, sore: 4, malam: 2 },
  { name: "Stasiun Kereta Api", pagi: 5, siang: 4, sore: 5, malam: 3 },
  { name: "Halte / Terminal Bus", pagi: 5, siang: 4, sore: 5, malam: 3 },
  { name: "Taman Kota / Terbuka", pagi: 4, siang: 2, sore: 5, malam: 4 },
  { name: "SPBU / Stasiun Pengisian Bahan Bakar", pagi: 4, siang: 4, sore: 5, malam: 3 },
  { name: "Lainnya", pagi: 2, siang: 2, sore: 2, malam: 2 },
  { name: "Masjid & Mushola", pagi: 3, siang: 4, sore: 4, malam: 4 },
  { name: "Gereja", pagi: 3, siang: 3, sore: 3, malam: 3 },
  { name: "Pura", pagi: 2, siang: 2, sore: 2, malam: 2 },
  { name: "Vihara", pagi: 2, siang: 2, sore: 2, malam: 2 },
  { name: "Tempat Ibadah (Lainnya)", pagi: 2, siang: 2, sore: 2, malam: 2 },
  { name: "Apotek", pagi: 3, siang: 4, sore: 4, malam: 3 },
  { name: "Rumah Sakit", pagi: 4, siang: 5, sore: 4, malam: 3 },
  { name: "Klinik & Puskesmas", pagi: 4, siang: 5, sore: 3, malam: 2 },
  { name: "Fasilitas Transit & Shelter", pagi: 4, siang: 4, sore: 4, malam: 3 },
  { name: "Toko Bangunan", pagi: 3, siang: 4, sore: 3, malam: 1 },
  { name: "Toko Mebel", pagi: 2, siang: 3, sore: 3, malam: 1 },
  { name: "Toko HP & Gadget", pagi: 2, siang: 3, sore: 4, malam: 3 },
  { name: "Provider & Telekomunikasi", pagi: 3, siang: 4, sore: 3, malam: 2 },
  { name: "Toko Elektronik", pagi: 2, siang: 3, sore: 3, malam: 2 },
  { name: "Pangkas Rambut & Salon", pagi: 2, siang: 3, sore: 4, malam: 3 },
  { name: "Studio & Fotografi", pagi: 2, siang: 3, sore: 3, malam: 2 },
  { name: "Jasa Pengiriman & Logistik", pagi: 3, siang: 4, sore: 4, malam: 2 },
  { name: "Toko Retail (Umum)", pagi: 3, siang: 3, sore: 4, malam: 3 },
  { name: "Sekolah Dasar (SD/MI)", pagi: 5, siang: 4, sore: 1, malam: 1 },
  { name: "Sekolah Menengah Pertama (SMP/MTs)", pagi: 5, siang: 4, sore: 1, malam: 1 },
  { name: "Sekolah Menengah Atas (SMA/SMK/MA)", pagi: 5, siang: 4, sore: 2, malam: 1 },
  { name: "Taman Kanak-Kanak / PAUD", pagi: 5, siang: 2, sore: 1, malam: 1 },
  { name: "Perguruan Tinggi", pagi: 4, siang: 5, sore: 4, malam: 3 },
  { name: "Pondok Pesantren", pagi: 3, siang: 3, sore: 3, malam: 3 },
  { name: "Sekolah (Umum)", pagi: 5, siang: 4, sore: 2, malam: 1 },
  { name: "Layanan Pemerintahan", pagi: 4, siang: 5, sore: 2, malam: 1 },
  { name: "Fasilitas Warga & Balai", pagi: 2, siang: 2, sore: 3, malam: 3 },
  { name: "Bengkel & Otomotif", pagi: 3, siang: 4, sore: 4, malam: 2 },
  { name: "Fasilitas Olahraga", pagi: 4, siang: 2, sore: 5, malam: 4 },
  { name: "Kolam Renang / Rekreasi Air", pagi: 4, siang: 4, sore: 4, malam: 1 },
  { name: "ATM / Mesin Tunai", pagi: 3, siang: 3, sore: 4, malam: 3 },
  { name: "Bank & Finansial", pagi: 4, siang: 5, sore: 3, malam: 1 },
  { name: "Fasilitas Parkir", pagi: 3, siang: 3, sore: 3, malam: 3 },
  { name: "Pemakaman", pagi: 2, siang: 1, sore: 1, malam: 1 },
];

async function seed() {
  console.log(`⏳ Seeding ${allCategories.length} POI categories into poi_categories table...`);
  for (const c of allCategories) {
    await pool.query(
      `INSERT INTO poi_categories (name, is_active, score_pagi, score_siang, score_sore, score_malam)
       VALUES ($1, true, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE SET
         score_pagi = EXCLUDED.score_pagi,
         score_siang = EXCLUDED.score_siang,
         score_sore = EXCLUDED.score_sore,
         score_malam = EXCLUDED.score_malam;`,
      [c.name, c.pagi, c.siang, c.sore, c.malam]
    );
  }

  const { rows } = await pool.query("SELECT count(*)::int as total FROM poi_categories;");
  console.log(`✅ Sukses! Total kategori POI di database saat ini: ${rows[0].total}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("💥 Gagal seed poi_categories:", err);
  process.exit(1);
});
