/*
 * seed-fresh.ts
 * Minimal Fresh-Setup Seed — Super Admin (first_login: true) + Kategori POI
 *
 * Digunakan untuk kondisi fresh install setelah:
 *   bun run db:reset && bun run db:migrate
 *
 * Isi:
 *   1. Akun Root Super Admin  (first_login: true, password: password123)
 *   2. Kategori POI + Matriks Skor Keramaian Waktu (17 kategori)
 *   3. System Settings minimal (SYSTEM_INITIALIZED = false → wajib lewat Setup Wizard)
 *
 * Jalankan:
 *   bun src/scripts/seed-fresh.ts
 */

import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";

async function seedFresh() {
  console.log("════════════════════════════════════════════");
  console.log("🌱  MOVA — FRESH SETUP SEED");
  console.log("════════════════════════════════════════════\n");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ─────────────────────────────────────────────
    // 1. SUPER ADMIN ROOT
    // ─────────────────────────────────────────────
    console.log("⏳ [1/3] Menyiapkan akun Root Super Admin...");
    const passwordHash = await bcrypt.hash("password123", 10);

    const { rows: [superAdmin] } = await client.query(
      `INSERT INTO users (email, username, password, name, role, is_active, first_login)
       VALUES ($1, $2, $3, $4, 'SUPERADMIN'::"Role", true, true)
       ON CONFLICT (email) DO UPDATE SET
         username    = EXCLUDED.username,
         password    = EXCLUDED.password,
         name        = EXCLUDED.name,
         role        = EXCLUDED.role,
         is_active   = true,
         first_login = true,
         updated_at  = CURRENT_TIMESTAMP
       RETURNING id, email, username, role, is_active, first_login;`,
      [
        "superadmin@kopikeliling.com",
        "superadmin",
        passwordHash,
        "Super Admin System",
      ]
    );

    console.log(`   ✅ ${superAdmin.email} (role: ${superAdmin.role}, first_login: ${superAdmin.first_login})\n`);

    // ─────────────────────────────────────────────
    // 2. KATEGORI POI + MATRIKS SKOR KERAMAIAN
    // ─────────────────────────────────────────────
    console.log("⏳ [2/3] Menyiapkan Kategori POI & Matriks Skor Keramaian Waktu...");

    // Pastikan tabel poi_categories tersedia (idempotent)
    await client.query(`
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
    `);

    const poiCategories = [
      // { name, pagi, siang, sore, malam }  — Skala Likert 1–5
      { name: "Hotel & Penginapan",                    pagi: 3, siang: 2, sore: 3, malam: 4 },
      { name: "Kafe & Kedai Kopi",                     pagi: 2, siang: 3, sore: 5, malam: 5 },
      { name: "Cepat Saji",                            pagi: 2, siang: 4, sore: 4, malam: 5 },
      { name: "Food Court",                            pagi: 2, siang: 5, sore: 4, malam: 5 },
      { name: "Restoran",                              pagi: 2, siang: 5, sore: 3, malam: 5 },
      { name: "Toko Minuman",                          pagi: 2, siang: 4, sore: 5, malam: 4 },
      { name: "Toko Roti & Kue",                       pagi: 3, siang: 3, sore: 4, malam: 3 },
      { name: "Minimarket",                            pagi: 3, siang: 4, sore: 4, malam: 4 },
      { name: "Supermarket",                           pagi: 2, siang: 4, sore: 4, malam: 4 },
      { name: "Mall / Pusat Perbelanjaan",             pagi: 2, siang: 4, sore: 5, malam: 5 },
      { name: "Pasar Tradisional",                     pagi: 5, siang: 4, sore: 2, malam: 1 },
      { name: "Perkantoran Komersial",                 pagi: 4, siang: 5, sore: 4, malam: 2 },
      { name: "Stasiun Kereta Api",                    pagi: 5, siang: 4, sore: 5, malam: 3 },
      { name: "Halte / Terminal Bus",                  pagi: 5, siang: 4, sore: 5, malam: 3 },
      { name: "Taman Kota / Terbuka",                  pagi: 4, siang: 2, sore: 5, malam: 4 },
      { name: "SPBU / Stasiun Pengisian Bahan Bakar",  pagi: 4, siang: 4, sore: 5, malam: 3 },
      { name: "Lainnya",                               pagi: 2, siang: 2, sore: 2, malam: 2 },
    ];

    for (const cat of poiCategories) {
      await client.query(
        `INSERT INTO poi_categories (name, is_active, score_pagi, score_siang, score_sore, score_malam)
         VALUES ($1, true, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET
           is_active   = true,
           score_pagi  = EXCLUDED.score_pagi,
           score_siang = EXCLUDED.score_siang,
           score_sore  = EXCLUDED.score_sore,
           score_malam = EXCLUDED.score_malam;`,
        [cat.name, cat.pagi, cat.siang, cat.sore, cat.malam]
      );
    }
    console.log(`   ✅ ${poiCategories.length} kategori POI berhasil disiapkan.\n`);

    // ─────────────────────────────────────────────
    // 3. KRITERIA SPK STANDAR (BWM-TOPSIS)
    // ─────────────────────────────────────────────
    console.log("⏳ [3/4] Menyiapkan 6 Kriteria SPK Standar (BWM)...");

    const criteriasData = [
      { name: "C1 - Densitas POI", type: "BENEFIT", weight: 0.32 },
      { name: "C2 - Diversitas POI", type: "BENEFIT", weight: 0.24 },
      { name: "C3 - Skor Keramaian Waktu", type: "BENEFIT", weight: 0.20 },
      { name: "C4 - Kondisi Cuaca", type: "COST", weight: 0.12 },
      { name: "C5 - Jarak Rider dari Hub ke Zona", type: "COST", weight: 0.08 },
      { name: "C6 - Jumlah Kompetitor di Zona", type: "COST", weight: 0.04 },
    ];

    for (const c of criteriasData) {
      await client.query(
        `INSERT INTO criterias (name, type, is_active, weight)
         VALUES ($1::text, $2::"CriteriaType", true, $3::float)
         ON CONFLICT (name) DO UPDATE SET
           type = EXCLUDED.type,
           weight = EXCLUDED.weight;`,
        [c.name, c.type, c.weight]
      );
    }
    console.log(`   ✅ ${criteriasData.length} kriteria SPK berhasil disiapkan.\n`);

    // ─────────────────────────────────────────────
    // 4. SYSTEM SETTINGS MINIMAL
    // ─────────────────────────────────────────────
    console.log("⏳ [4/4] Menyiapkan System Settings minimal...");

    const systemSettings = [
      { key: "SYSTEM_INITIALIZED",       value: "false",           description: "Status Inisialisasi Pertama Sistem — wajib selesaikan Setup Wizard" },
      { key: "SYSTEM_SETUP_CURRENT_STEP", value: "1",              description: "Tahapan Wizard Inisialisasi Sistem saat ini" },
      { key: "SYSTEM_NAME",              value: "MOVA",            description: "Nama Resmi Sistem Operasional" },
      { key: "BUSINESS_NAME",            value: "MOVA",            description: "Nama Bisnis Operasional" },
      { key: "OPERATING_HOURS_START",    value: "07:00",           description: "Jam Mulai Operasi Harian" },
      { key: "OPERATING_HOURS_END",      value: "21:00",           description: "Jam Selesai Operasi Harian" },
      { key: "OPERATIONAL_RADIUS_KM",    value: "12",              description: "Radius Maksimal Operasi dari Hub (KM)" },
    ];

    for (const s of systemSettings) {
      await client.query(
        `INSERT INTO system_settings (key, value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET
           value       = EXCLUDED.value,
           description = EXCLUDED.description;`,
        [s.key, s.value, s.description]
      );
    }
    console.log(`   ✅ ${systemSettings.length} system settings disiapkan.\n`);

    await client.query("COMMIT");

    console.log("════════════════════════════════════════════");
    console.log("🎉  FRESH SEED SELESAI");
    console.log("════════════════════════════════════════════");
    console.log("");
    console.log("  Akun Super Admin:");
    console.log("  📧  Email       : superadmin@kopikeliling.com");
    console.log("  🔑  Password    : password123  (sementara)");
    console.log("  ⚡  first_login : true  ← akan diarahkan ke /first-login");
    console.log("");
    console.log("  Langkah berikutnya:");
    console.log("  1. Buka http://localhost:5173");
    console.log("  2. Login → diarahkan ke /first-login → ganti password");
    console.log("  3. Masuk dashboard → selesaikan Setup Wizard (/setup)");
    console.log("════════════════════════════════════════════\n");

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("❌ Seed gagal (ROLLBACK):", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedFresh();
