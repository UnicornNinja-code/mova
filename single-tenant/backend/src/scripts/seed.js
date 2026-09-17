/*
 * COZIS (Coffee Operational Zone Intelligence System) — Master Seeding Script
 * Baseline Clean Master Data (Single-Tenant 4-Role RBAC & DSS Engine)
 */

import bcrypt from "bcrypt";
import { pool } from "../config/database.js";

async function seedCleanData() {
  console.log("🌱 Memulai Seeding Master Data Bersih (Single-Tenant COZIS)...");

  try {
    // 0. Pengosongan Tabel Transaksional & Log
    console.log("⏳ Membersihkan tabel transaksional & log lama...");
    await pool.query(`
      TRUNCATE TABLE 
        sales_logs, 
        recommendations, 
        dss_histories, 
        zone_assignments, 
        rider_duty_queues, 
        audit_logs, 
        refresh_tokens, 
        password_reset_tokens
      CASCADE;
    `);

    // 1. Akun Pengguna 4-Role Utama (SUPERADMIN, MANAGEMENT, SUPERVISOR, RIDER)
    console.log("⏳ Seeding 4-Role Akun Pengguna Utama (Clean RBAC)...");
    const defaultPasswordHash = await bcrypt.hash("password123", 10);

    const usersData = [
      {
        email: "superadmin@kopikeliling.com",
        username: "superadmin",
        password: defaultPasswordHash,
        name: "Super Admin System",
        phone: "081234567890",
        role: "SUPERADMIN",
      },
      {
        email: "management@kopikeliling.com",
        username: "management1",
        password: defaultPasswordHash,
        name: "Branch Management Sidoarjo",
        phone: "081234567891",
        role: "MANAGEMENT",
      },
      {
        email: "supervisor@kopikeliling.com",
        username: "supervisor1",
        password: defaultPasswordHash,
        name: "Supervisor Operasional Lapangan",
        phone: "081234567892",
        role: "SUPERVISOR",
      },
      {
        email: "rider@kopikeliling.com",
        username: "rider1",
        password: defaultPasswordHash,
        name: "Rider Operasional Utama",
        phone: "081234567893",
        role: "RIDER",
      },
      {
        email: "rider2@kopikeliling.com",
        username: "rider2",
        password: defaultPasswordHash,
        name: "Rider Operasional Cadangan",
        phone: "081234567894",
        role: "RIDER",
      },
    ];

    for (const u of usersData) {
      const query = `
        INSERT INTO users (email, username, password, name, phone, role)
        VALUES ($1, $2, $3, $4, $5, $6::"Role")
        ON CONFLICT (email) DO UPDATE SET
          username = EXCLUDED.username,
          password = EXCLUDED.password,
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role;
      `;
      await pool.query(query, [u.email, u.username, u.password, u.name, u.phone, u.role]);
    }
    console.log(`✅ 4-Role Pengguna Utama (Superadmin, Management, Supervisor, Rider) siap.`);

    // 2. Kategori POI Master (35+ Granular Categories aligned with POIClusterer & Likert 1-5 Operational Time Scores)
    console.log("⏳ Seeding Kategori POI Master (Granular & Likert Baseline)...");
    const poiCategories = [
      // Tempat Ibadah
      { name: "Masjid & Mushola", score_pagi: 4, score_siang: 4, score_sore: 4, score_malam: 5 },
      { name: "Gereja", score_pagi: 3, score_siang: 3, score_sore: 4, score_malam: 3 },
      { name: "Pura", score_pagi: 3, score_siang: 3, score_sore: 3, score_malam: 3 },
      { name: "Vihara", score_pagi: 3, score_siang: 3, score_sore: 3, score_malam: 3 },
      { name: "Tempat Ibadah (Lainnya)", score_pagi: 3, score_siang: 3, score_sore: 3, score_malam: 3 },
      { name: "Tempat Ibadah", score_pagi: 4, score_siang: 4, score_sore: 3, score_malam: 3 },

      // Kesehatan
      { name: "Apotek", score_pagi: 3, score_siang: 4, score_sore: 4, score_malam: 3 },
      { name: "Rumah Sakit", score_pagi: 4, score_siang: 5, score_sore: 4, score_malam: 3 },
      { name: "Klinik & Puskesmas", score_pagi: 4, score_siang: 5, score_sore: 3, score_malam: 1 },

      // Transportasi & Transit
      { name: "Stasiun Kereta Api", score_pagi: 5, score_siang: 4, score_sore: 5, score_malam: 4 },
      { name: "Halte / Terminal Bus", score_pagi: 5, score_siang: 4, score_sore: 5, score_malam: 3 },
      { name: "Fasilitas Transit & Shelter", score_pagi: 4, score_siang: 4, score_sore: 4, score_malam: 3 },
      { name: "Transportasi / Stasiun", score_pagi: 5, score_siang: 3, score_sore: 5, score_malam: 3 },

      // Kuliner & Kafe
      { name: "Food Court", score_pagi: 2, score_siang: 5, score_sore: 5, score_malam: 5 },
      { name: "Cepat Saji", score_pagi: 3, score_siang: 5, score_sore: 5, score_malam: 5 },
      { name: "Restoran", score_pagi: 3, score_siang: 5, score_sore: 5, score_malam: 5 },
      { name: "Toko Minuman", score_pagi: 2, score_siang: 5, score_sore: 5, score_malam: 4 },
      { name: "Kafe & Kedai Kopi", score_pagi: 3, score_siang: 4, score_sore: 5, score_malam: 5 },
      { name: "Toko Roti & Kue", score_pagi: 4, score_siang: 4, score_sore: 4, score_malam: 3 },

      // Retail, Supermarket & Perbelanjaan
      { name: "Minimarket", score_pagi: 4, score_siang: 5, score_sore: 5, score_malam: 5 },
      { name: "Supermarket", score_pagi: 3, score_siang: 4, score_sore: 5, score_malam: 5 },
      { name: "Mall / Pusat Perbelanjaan", score_pagi: 2, score_siang: 4, score_sore: 5, score_malam: 5 },
      { name: "Pusat Perbelanjaan", score_pagi: 2, score_siang: 4, score_sore: 5, score_malam: 5 },
      { name: "Pasar Tradisional", score_pagi: 5, score_siang: 4, score_sore: 2, score_malam: 1 },
      { name: "Toko Bangunan", score_pagi: 4, score_siang: 4, score_sore: 3, score_malam: 1 },
      { name: "Toko Mebel", score_pagi: 3, score_siang: 3, score_sore: 3, score_malam: 1 },
      { name: "Toko HP & Gadget", score_pagi: 2, score_siang: 4, score_sore: 4, score_malam: 4 },
      { name: "Provider & Telekomunikasi", score_pagi: 3, score_siang: 4, score_sore: 4, score_malam: 2 },
      { name: "Toko Elektronik", score_pagi: 3, score_siang: 4, score_sore: 4, score_malam: 3 },
      { name: "Pangkas Rambut & Salon", score_pagi: 2, score_siang: 4, score_sore: 4, score_malam: 4 },
      { name: "Studio & Fotografi", score_pagi: 2, score_siang: 3, score_sore: 4, score_malam: 3 },
      { name: "Jasa Pengiriman & Logistik", score_pagi: 4, score_siang: 5, score_sore: 4, score_malam: 2 },
      { name: "Toko Retail (Umum)", score_pagi: 3, score_siang: 4, score_sore: 4, score_malam: 3 },

      // Pendidikan
      { name: "Sekolah Dasar (SD/MI)", score_pagi: 5, score_siang: 4, score_sore: 2, score_malam: 1 },
      { name: "Sekolah Menengah Pertama (SMP/MTs)", score_pagi: 5, score_siang: 5, score_sore: 2, score_malam: 1 },
      { name: "Sekolah Menengah Atas (SMA/SMK/MA)", score_pagi: 5, score_siang: 5, score_sore: 3, score_malam: 1 },
      { name: "Taman Kanak-Kanak / PAUD", score_pagi: 5, score_siang: 2, score_sore: 1, score_malam: 1 },
      { name: "Perguruan Tinggi", score_pagi: 5, score_siang: 5, score_sore: 4, score_malam: 3 },
      { name: "Pondok Pesantren", score_pagi: 4, score_siang: 4, score_sore: 4, score_malam: 4 },
      { name: "Sekolah (Umum)", score_pagi: 5, score_siang: 4, score_sore: 2, score_malam: 1 },
      { name: "Sekolah & Universitas", score_pagi: 5, score_siang: 4, score_sore: 3, score_malam: 1 },

      // Layanan Pemerintahan & Publik
      { name: "Layanan Pemerintahan", score_pagi: 5, score_siang: 5, score_sore: 2, score_malam: 1 },

      // Fasilitas Warga, Otomotif & Akomodasi
      { name: "Fasilitas Warga & Balai", score_pagi: 3, score_siang: 3, score_sore: 4, score_malam: 4 },
      { name: "Bengkel & Otomotif", score_pagi: 4, score_siang: 5, score_sore: 4, score_malam: 2 },
      { name: "Hotel & Penginapan", score_pagi: 3, score_siang: 3, score_sore: 4, score_malam: 4 },

      // Taman, Olahraga & Rekreasi
      { name: "Taman Kota / Terbuka", score_pagi: 5, score_siang: 2, score_sore: 5, score_malam: 4 },
      { name: "Taman & Ruang Terbuka", score_pagi: 4, score_siang: 2, score_sore: 5, score_malam: 4 },
      { name: "Fasilitas Olahraga", score_pagi: 5, score_siang: 2, score_sore: 5, score_malam: 4 },
      { name: "Kolam Renang / Rekreasi Air", score_pagi: 4, score_siang: 4, score_sore: 4, score_malam: 1 },

      // Finansial, Perkantoran & Utilitas
      { name: "ATM / Mesin Tunai", score_pagi: 4, score_siang: 5, score_sore: 5, score_malam: 4 },
      { name: "Bank & Finansial", score_pagi: 5, score_siang: 5, score_sore: 2, score_malam: 1 },
      { name: "Perkantoran Komersial", score_pagi: 5, score_siang: 5, score_sore: 4, score_malam: 1 },
      { name: "Perkantoran", score_pagi: 5, score_siang: 5, score_sore: 4, score_malam: 1 },
      { name: "Kawasan Industri", score_pagi: 4, score_siang: 4, score_sore: 3, score_malam: 1 },
      { name: "SPBU / Stasiun Pengisian Bahan Bakar", score_pagi: 4, score_siang: 4, score_sore: 5, score_malam: 4 },
      { name: "Fasilitas Parkir", score_pagi: 3, score_siang: 4, score_sore: 4, score_malam: 3 },
      { name: "Pemakaman", score_pagi: 2, score_siang: 1, score_sore: 1, score_malam: 1 },
      { name: "Lainnya", score_pagi: 1, score_siang: 1, score_sore: 1, score_malam: 1 },
    ];

    for (const cat of poiCategories) {
      await pool.query(
        `INSERT INTO poi_categories (name, score_pagi, score_siang, score_sore, score_malam, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (name) DO UPDATE SET
           score_pagi = EXCLUDED.score_pagi,
           score_siang = EXCLUDED.score_siang,
           score_sore = EXCLUDED.score_sore,
           score_malam = EXCLUDED.score_malam,
           is_active = true;`,
        [cat.name, cat.score_pagi, cat.score_siang, cat.score_sore, cat.score_malam]
      );
    }
    console.log(`✅ ${poiCategories.length} Kategori POI master siap.`);

    // 3. 6 Kriteria Inti DSS Skripsi (C1-C6)
    console.log("⏳ Seeding 6 Kriteria Inti DSS Skripsi (C1-C6)...");
    const criterias = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: 0.25, description: "Kepadatan titik keramaian potensial dalam zona (Distinct Logical POI)" },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: 0.20, description: "Keberagaman kategori titik keramaian dalam zona (Distinct Category)" },
      { code: "C3", name: "Keramaian Waktu", type: "BENEFIT", weight: 0.20, description: "Tingkat keramaian berbasis slot waktu operasional (Likert 1-5 Baseline)" },
      { code: "C4", name: "Kondisi Cuaca", type: "COST", weight: 0.15, description: "Risiko presipitasi hujan real-time Open-Meteo API (%)" },
      { code: "C5", name: "Jarak Aksesibilitas", type: "COST", weight: 0.10, description: "Jarak geodesik asal (Hub Default / Live Rider) ke centroid zona (KM)" },
      { code: "C6", name: "Tingkat Persaingan", type: "COST", weight: 0.10, description: "Indeks pembobotan ancaman kompetitor (Survei Lapangan + Kafe OSM)" },
    ];

    for (const c of criterias) {
      await pool.query(
        `INSERT INTO criterias (code, name, type, weight, description)
         VALUES ($1, $2, $3::"CriteriaType", $4, $5)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           weight = EXCLUDED.weight,
           description = EXCLUDED.description;`,
        [c.code, c.name, c.type, c.weight, c.description]
      );
    }
    console.log(`✅ 6 Kriteria DSS Skripsi berhasil disiapkan.`);

    // 4. Master Produk / Katalog
    console.log("⏳ Seeding Master Produk / Katalog...");
    const products = [
      { name: "Kopi Susu Gula Aren", description: "Kopi susu espresso blend dengan sirup gula aren asli", price: 10000.00 },
      { name: "Kopi Hitam Tubruk Robusta", description: "Kopi hitam khas nusantara dengan body tebal", price: 6000.00 },
      { name: "Es Kopi Butterscotch", description: "Kopi susu kekinian dengan aroma karamel mentega", price: 12000.00 },
      { name: "Teh Tarik Madu", description: "Minuman teh tarik creamy manis legit madu", price: 8000.00 },
      { name: "Cokelat Klasik Dingin", description: "Minuman cokelat kental premium dingin", price: 10000.00 },
    ];

    for (const p of products) {
      const checkRes = await pool.query("SELECT id FROM products WHERE name = $1", [p.name]);
      if (checkRes.rows.length === 0) {
        await pool.query(
          "INSERT INTO products (name, description, price) VALUES ($1, $2, $3)",
          [p.name, p.description, p.price]
        );
      }
    }
    console.log(`✅ ${products.length} Master Produk katalog siap.`);

    // 5. Master Armada Gerobak Keliling
    console.log("⏳ Seeding Master Unit Armada...");
    const armadas = [
      { code: "GBK-SDA-01", type: "GEROBAK", status: "ACTIVE" },
      { code: "GBK-SDA-02", type: "GEROBAK", status: "ACTIVE" },
      { code: "GBK-SDA-03", type: "GEROBAK", status: "ACTIVE" },
      { code: "GBK-SDA-04", type: "GEROBAK", status: "ACTIVE" },
      { code: "MTR-SDA-01", type: "MOTOR_LISTRIK", status: "ACTIVE" },
    ];

    for (const a of armadas) {
      await pool.query(
        `INSERT INTO armadas (code, type, status)
         VALUES ($1, $2::"ArmadaType", $3::"ArmadaStatus")
         ON CONFLICT (code) DO UPDATE SET
           type = EXCLUDED.type,
           status = EXCLUDED.status;`,
        [a.code, a.type, a.status]
      );
    }
    console.log(`✅ ${armadas.length} Unit Armada master siap.`);

    // 6. System Settings Default
    console.log("⏳ Seeding Pengaturan Sistem...");
    const settings = [
      { key: "APP_NAME", value: "MOVA - Coffee Operational Zone Intelligence System", description: "Nama identitas sistem" },
      { key: "ARMADA_HOLD_DURATION_MINUTES", value: "5", description: "Batas durasi lock booking armada sementara bagi rider" },
      { key: "RESTRICTED_ROAD_PROXIMITY_METERS", value: "50", description: "Jarak batas aman telemetri rider dari jalan protokol terlarang" },
      { key: "MAX_ZONE_CAPACITY_DEFAULT", value: "3", description: "Batas maksimal rider dalam 1 zona operasional secara default" },
    ];

    // 7. Master Operational Zones Sidoarjo
    console.log("⏳ Seeding Master Zona Operasional Sidoarjo...");
    const zones = [
      {
        name: "Zona Alun-Alun Sidoarjo",
        description: "Pusat keramaian publik, taman kota, dan area rekreasi masyarakat Sidoarjo",
        max_capacity: 4,
        status: "ACTIVE",
        polygon: {
          type: "Polygon",
          coordinates: [
            [
              [112.7160, -7.4460],
              [112.7210, -7.4460],
              [112.7210, -7.4510],
              [112.7160, -7.4510],
              [112.7160, -7.4460]
            ]
          ]
        }
      },
      {
        name: "Zona GOR Delta Sidoarjo",
        description: "Kompleks olahraga, sentra kuliner, dan keramaian event komunitas",
        max_capacity: 3,
        status: "ACTIVE",
        polygon: {
          type: "Polygon",
          coordinates: [
            [
              [112.7050, -7.4530],
              [112.7120, -7.4530],
              [112.7120, -7.4590],
              [112.7050, -7.4590],
              [112.7050, -7.4530]
            ]
          ]
        }
      }
    ];

    for (const z of zones) {
      const checkZone = await pool.query("SELECT id FROM zones WHERE name = $1", [z.name]);
      if (checkZone.rows.length === 0) {
        const polyGeoJsonStr = JSON.stringify(z.polygon);
        await pool.query(
          `INSERT INTO zones (name, description, max_capacity, status, polygon, geom)
           VALUES ($1, $2, $3, $4::"ZoneStatus", $5::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326));`,
          [z.name, z.description, z.max_capacity, z.status, polyGeoJsonStr, polyGeoJsonStr]
        );
      }
    }
    console.log(`✅ ${zones.length} Master Zona Operasional berhasil disiapkan.`);

    console.log("\n🎉 Seeding Master Data Single-Tenant Sukses 100%!");
  } catch (error) {
    console.error("❌ Gagal melakukan seeding master data:", error);
    throw error;
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  seedCleanData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedCleanData };
