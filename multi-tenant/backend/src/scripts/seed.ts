/*
 * seed.ts
 * Comprehensive Initial Master & Operational Data Seed Script (Bun + TypeScript)
 */

import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";
import { syncProtocolRoadsService } from "../services/roadService.js";

async function seedCleanData() {
  console.log("🌱 Memulai Seeding Master Data & Operasional Koling App...");

  try {
    // 0. Pengosongan Tabel Transaksional & Log
    console.log("⏳ Membersihkan tabel transaksional & log lama...");
    await pool.query(`
      TRUNCATE TABLE 
        sales_logs, 
        recommendations, 
        dss_histories, 
        sessions, 
        zone_assignments, 
        rider_duty_queues, 
        competitors, 
        audit_logs, 
        refresh_tokens, 
        password_reset_tokens
      CASCADE;
    `);

    // 1. Skema Kategori POI & Protocol Roads Helper
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poi_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) UNIQUE NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        score_pagi int NOT NULL DEFAULT 1 CHECK (score_pagi BETWEEN 1 AND 5),
        score_siang int NOT NULL DEFAULT 1 CHECK (score_siang BETWEEN 1 AND 5),
        score_sore int NOT NULL DEFAULT 1 CHECK (score_sore BETWEEN 1 AND 5),
        score_malam int NOT NULL DEFAULT 1 CHECK (score_malam BETWEEN 1 AND 5),
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE pois DROP COLUMN IF EXISTS zone_id;
    `);

    // 2. Akun Pengguna Utama (Hanya 1 Akun Root Superadmin untuk Fresh Bootstrap)
    console.log("⏳ Seeding Akun Root Super Admin...");
    const defaultPasswordHash = await bcrypt.hash("password123", 10);

    const usersData = [
      {
        email: "superadmin@kopikeliling.com",
        username: "superadmin",
        password: defaultPasswordHash,
        name: "Super Admin System",
        role: "SUPERADMIN",
        first_login: true, // Wajib ganti password saat pertama login
      },
    ];

    for (const u of usersData) {
      const query = `
        INSERT INTO users (email, username, password, name, role, is_active, first_login)
        VALUES ($1, $2, $3, $4, $5::"Role", true, $6)
        ON CONFLICT (email) DO UPDATE SET
          username    = EXCLUDED.username,
          password    = EXCLUDED.password,
          name        = EXCLUDED.name,
          role        = EXCLUDED.role,
          is_active   = true,
          first_login = EXCLUDED.first_login;
      `;
      await pool.query(query, [u.email, u.username, u.password, u.name, u.role, u.first_login]);
    }
    console.log(`✅ Akun root Super Admin berhasil disiapkan: superadmin@kopikeliling.com (first_login: true)`);

    // 3. Kriteria SPK BWM-TOPSIS Standard
    console.log("⏳ Seeding Kriteria SPK Standar...");
    const criteriasData = [
      { name: "C1 - Densitas POI", type: "BENEFIT", weight: 0.32 },
      { name: "C2 - Diversitas POI", type: "BENEFIT", weight: 0.24 },
      { name: "C3 - Skor Keramaian Waktu", type: "BENEFIT", weight: 0.20 },
      { name: "C4 - Kondisi Cuaca", type: "COST", weight: 0.12 },
      { name: "C5 - Jarak Rider dari Hub ke Zona", type: "COST", weight: 0.08 },
      { name: "C6 - Jumlah Kompetitor di Zona", type: "COST", weight: 0.04 },
    ];

    for (const c of criteriasData) {
      const query = `
        INSERT INTO criterias (name, type, is_active, weight)
        VALUES ($1::text, $2::"CriteriaType", true, $3::float)
        ON CONFLICT (name) DO UPDATE SET
          type = EXCLUDED.type,
          weight = EXCLUDED.weight;
      `;
      await pool.query(query, [c.name, c.type, c.weight]);
    }
    console.log(`✅ ${criteriasData.length} kriteria SPK standar berhasil disiapkan.`);

    // 3.1 Seeding Konfigurasi BWM Awal di dss_configurations
    const critRows = (await pool.query("SELECT id, name FROM criterias ORDER BY name;")).rows;
    if (critRows.length >= 2) {
      const bestCrit = critRows[0];
      const worstCrit = critRows[critRows.length - 1];
      const b2o: Record<string, number> = {};
      const w2o: Record<string, number> = {};
      critRows.forEach((c, idx) => {
        b2o[c.id] = idx + 1;
        w2o[c.id] = critRows.length - idx;
      });
      await pool.query(
        `INSERT INTO dss_configurations (name, is_active, best_criteria_id, worst_criteria_id, best_to_others, worst_to_others)
         VALUES ($1, true, $2, $3, $4, $5);`,
        ["Konfigurasi Standar Sidoarjo (BWM-TOPSIS)", bestCrit.id, worstCrit.id, JSON.stringify(b2o), JSON.stringify(w2o)]
      );
      console.log("✅ Konfigurasi aktif BWM (dss_configurations) berhasil disiapkan.");
    }

    // 4. Kategori POI Matriks Skor Keramaian Waktu (Likert 1-5)
    console.log("⏳ Seeding 51 Kategori POI & Matriks Keramaian Waktu...");
    const poiCategoriesData = [
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
    ];

    for (const cat of poiCategoriesData) {
      const query = `
        INSERT INTO poi_categories (name, is_active, score_pagi, score_siang, score_sore, score_malam)
        VALUES ($1, true, $2, $3, $4, $5)
        ON CONFLICT (name) DO UPDATE SET
          is_active = true,
          score_pagi = EXCLUDED.score_pagi,
          score_siang = EXCLUDED.score_siang,
          score_sore = EXCLUDED.score_sore,
          score_malam = EXCLUDED.score_malam;
      `;
      await pool.query(query, [cat.name, cat.pagi, cat.siang, cat.sore, cat.malam]);
    }
    console.log(`✅ ${poiCategoriesData.length} matriks kategori POI disiapkan.`);

    // 5. Konfigurasi Sistem (System Settings)
    console.log("⏳ Seeding Konfigurasi Sistem...");
    const settingsData = [
      { key: "SYSTEM_NAME", value: "MantaKopi COZIS", description: "Nama Resmi Sistem Operasional" },
      { key: "HUB_CITY_NAME", value: "Sidoarjo", description: "Nama Kota Hub/Gudang Operasional" },
      { key: "HUB_LATITUDE", value: "-7.4478", description: "Koordinat Central Hub Sidoarjo (Latitude)" },
      { key: "HUB_LONGITUDE", value: "112.7183", description: "Koordinat Central Hub Sidoarjo (Longitude)" },
      { key: "HUB_BOUNDS_BUFFER", value: "0.15", description: "Buffer Wilayah Spasial Operasional" },
      { key: "DEFAULT_DSS_ACTIVE", value: "true", description: "Status aktif default SPK" },
      { key: "SYSTEM_INITIALIZED", value: "false", description: "Status Inisialisasi Pertama Sistem (First-Run)" },
      { key: "SYSTEM_SETUP_CURRENT_STEP", value: "IDENTITY", description: "Tahapan Wizard Inisialisasi Sistem" },
      { key: "OPERATING_HOURS_START", value: "06:00", description: "Jam Mulai Operasi Harian" },
      { key: "OPERATING_HOURS_END", value: "22:00", description: "Jam Selesai Operasi Harian" },
      { key: "OPERATIONAL_RADIUS_KM", value: "12", description: "Radius Maksimal Operasi dari Hub (KM)" },
    ];

    for (const s of settingsData) {
      const query = `
        INSERT INTO system_settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          description = EXCLUDED.description;
      `;
      await pool.query(query, [s.key, s.value, s.description]);
    }
    console.log(`✅ ${settingsData.length} konfigurasi sistem disiapkan.`);

    // 6. Master Produk Menu
    console.log("⏳ Seeding Master Produk...");
    const productsData = [
      { name: "Es Kopi Susu Gula Aren", description: "Espresso dengan susu segar dan gula aren murni", price: 18000, status: "AVAILABLE" },
      { name: "Kopi Hitam (Americano)", description: "Espresso blend robusta-arabika hangat/dingin", price: 12000, status: "AVAILABLE" },
      { name: "Matcha Latte Premium", description: "Matcha Uji Jepang dengan susu segar", price: 20000, status: "AVAILABLE" },
      { name: "Caramel Macchiato", description: "Espresso dengan saus caramel kental dan steamed milk", price: 22000, status: "AVAILABLE" },
      { name: "Croissant Butter", description: "Pastry renyah dengan butter Perancis", price: 15000, status: "AVAILABLE" },
    ];

    const insertedProducts: any[] = [];
    for (const p of productsData) {
      const query = `
        INSERT INTO products (name, description, price, status)
        VALUES ($1::text, $2::text, $3::double precision, $4::"ProductStatus")
        ON CONFLICT (name) DO UPDATE SET
          price = EXCLUDED.price,
          status = EXCLUDED.status
        RETURNING id, name, price;
      `;
      const res = await pool.query(query, [p.name, p.description, p.price, p.status]);
      insertedProducts.push(res.rows[0]);
    }
    console.log(`✅ ${productsData.length} master produk disiapkan.`);

    // 7. Master Unit Armada Operasional (Semua unit AVAILABLE / ACTIVE siap pakai)
    console.log("⏳ Seeding Master Armada (Kondisi Bersih - Siap Pakai)...");
    const armadasData = [
      { code: "ARM-ML-001", type: "MOTOR_LISTRIK", status: "ACTIVE" },
      { code: "ARM-ML-002", type: "MOTOR_LISTRIK", status: "ACTIVE" },
      { code: "ARM-ML-003", type: "MOTOR_LISTRIK", status: "ACTIVE" },
      { code: "ARM-GB-001", type: "GEROBAK", status: "ACTIVE" },
      { code: "ARM-GB-002", type: "GEROBAK", status: "ACTIVE" },
      { code: "ARM-GB-003", type: "GEROBAK", status: "ACTIVE" },
    ];

    for (const a of armadasData) {
      const query = `
        INSERT INTO armadas (code, type, status)
        VALUES ($1, $2::"ArmadaType", $3::"ArmadaStatus")
        ON CONFLICT (code) DO UPDATE SET
          type = EXCLUDED.type,
          status = EXCLUDED.status;
      `;
      await pool.query(query, [a.code, a.type, a.status]);
    }
    console.log(`✅ ${armadasData.length} unit armada operasional disiapkan (seluruh unit ACTIVE).`);

    // 8. Master Zona Operasional (4 Poligon Dasar Sidoarjo)
    console.log("⏳ Seeding Master Zona Operasional...");
    const zonesData = [
      {
        name: "Zona Sidoarjo 1 - Alun-Alun",
        description: "Pusat Keramaian Alun-Alun Sidoarjo",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: {
          type: "Polygon",
          coordinates: [[[112.7150, -7.4450], [112.7210, -7.4450], [112.7210, -7.4500], [112.7150, -7.4500], [112.7150, -7.4450]]]
        }
      },
      {
        name: "Zona Sidoarjo 2 - Gajah Mada",
        description: "Kawasan Komersial Jalan Gajah Mada Sidoarjo",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: {
          type: "Polygon",
          coordinates: [[[112.7120, -7.4500], [112.7180, -7.4500], [112.7180, -7.4550], [112.7120, -7.4550], [112.7120, -7.4500]]]
        }
      },
      {
        name: "Zona Sidoarjo 3 - Pahlawan",
        description: "Klaster Ritel Jalan Pahlawan Sidoarjo",
        max_capacity: 4,
        status: "ACTIVE",
        polygon: {
          type: "Polygon",
          coordinates: [[[112.7090, -7.4410], [112.7150, -7.4410], [112.7150, -7.4460], [112.7090, -7.4460], [112.7090, -7.4410]]]
        }
      },
      {
        name: "Zona Sidoarjo 4 - GOR Delta",
        description: "Area Olahraga & Rekreasi GOR Delta Sidoarjo",
        max_capacity: 5,
        status: "ACTIVE",
        polygon: {
          type: "Polygon",
          coordinates: [[[112.7060, -7.4550], [112.7130, -7.4550], [112.7130, -7.4610], [112.7060, -7.4610], [112.7060, -7.4550]]]
        }
      }
    ];

    const insertedZones: any[] = [];
    for (const z of zonesData) {
      const query = `
        INSERT INTO zones (name, description, max_capacity, status, polygon)
        VALUES ($1::text, $2::text, $3::int, $4::"ZoneStatus", $5::jsonb)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          max_capacity = EXCLUDED.max_capacity,
          status = EXCLUDED.status,
          polygon = EXCLUDED.polygon
        RETURNING id, name;
      `;
      const res = await pool.query(query, [z.name, z.description, z.max_capacity, z.status, JSON.stringify(z.polygon)]);
      insertedZones.push(res.rows[0]);
    }
    console.log(`✅ ${insertedZones.length} master zona operasional disiapkan.`);

    // 9. Seeding In-App Notifications (1 Welcome Notification)
    console.log("⏳ Seeding Notifikasi Awal Sistem...");
    const { rows: adminRows } = await pool.query(`SELECT id FROM users WHERE role = 'SUPERADMIN' LIMIT 1;`);
    if (adminRows.length > 0) {
      const superadminId = adminRows[0].id;
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, is_read) VALUES ($1, $2, $3, false);`,
        [
          superadminId,
          "Sistem MantaKopi COZIS Bersih & Siap Digunakan",
          "Database berhasil direset. Silakan mulai dengan konfigurasi zona, pembagian armada, atau undang staf baru.",
        ]
      );
      console.log(`✅ 1 notifikasi selamat datang disiapkan.`);
    }

    // 10. Seeding Data Spasial Jalan Protokol & Tol (PostGIS)
    console.log("⏳ Seeding Lapisan Spasial Jalan Protokol (PostGIS)...");
    const roadRes = await syncProtocolRoadsService(false);
    console.log(`✅ ${roadRes.totalRoads} ruas jalan protokol aktif terdaftar di PostGIS.`);

    console.log("\n==================================================");
    console.log("🎉 SEEDING CLEAN MASTER DATA SELESAI SUKSES!");
    console.log("==================================================\n");
  } catch (error: any) {
    console.error("❌ Gagal melakukan Seeding Data:", error.message);
  } finally {
    await pool.end();
  }
}

export { seedCleanData };
seedCleanData();
