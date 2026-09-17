/*
 * seed-fresh.js
 * Minimal Fresh-Setup Seed — Super Admin (first_login: true) + Kategori POI + Kriteria DSS + System Settings
 *
 * Digunakan untuk kondisi fresh install / Day-0:
 *   bun run db:reset && bun run db:migrate && bun run db:seed:fresh
 *   atau
 *   node src/scripts/reset-db.js && node src/scripts/migrate.js && node src/scripts/seed-fresh.js
 *
 * Isi:
 *   1. Akun Root Super Admin (first_login: true, password: password123, role: SUPERADMIN)
 *   2. Kategori POI + Matriks Skor Keramaian Waktu (17 kategori standar)
 *   3. 6 Kriteria SPK Inti (C1-C6 BWM-TOPSIS Baseline)
 *   4. System Settings Day-0 (SYSTEM_INITIALIZED = false → wajib lewat onboarding/setup)
 *   5. Lapisan Spasial Restriksi Jalan Protokol & Tol (PostGIS)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import format from "pg-format";
import bcrypt from "bcrypt";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedFresh() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("🌱  MOVA — FRESH ONBOARDING SETUP SEED (Single-Tenant)");
  console.log("    Mobile Operations & Visibility Application");
  console.log("════════════════════════════════════════════════════════════\n");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 0. Membersihkan data transaksional lama & non-superadmin users
    console.log("⏳ [1/5] Membersihkan tabel transaksional, log, dan pengguna non-root...");
    await client.query(`
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

    // Bersihkan user lama selain superadmin default
    await client.query(`
      DELETE FROM users 
      WHERE email != 'superadmin@kopikeliling.com';
    `);

    // ─────────────────────────────────────────────
    // 1. SUPER ADMIN ROOT (first_login = true)
    // ─────────────────────────────────────────────
    console.log("⏳ [2/5] Menyiapkan akun Root Super Admin Day-0 (first_login = true)...");
    const passwordHash = await bcrypt.hash("password123", 10);

    const { rows: [superAdmin] } = await client.query(
      `INSERT INTO users (email, username, password, name, phone, role, is_active, first_login, birth_date)
       VALUES ($1, $2, $3, $4, $5, 'SUPERADMIN'::"Role", true, true, $6)
       ON CONFLICT (email) DO UPDATE SET
         username    = EXCLUDED.username,
         password    = EXCLUDED.password,
         name        = EXCLUDED.name,
         phone       = EXCLUDED.phone,
         role        = EXCLUDED.role,
         is_active   = true,
         first_login = true,
         birth_date  = EXCLUDED.birth_date,
         updated_at  = CURRENT_TIMESTAMP
       RETURNING id, email, username, name, role, is_active, first_login, birth_date;`,
      [
        "superadmin@kopikeliling.com",
        "superadmin",
        passwordHash,
        "Super Admin System",
        "08110000001",
        "1990-01-01",
      ]
    );

    console.log(`   ✅ ${superAdmin.email} (role: ${superAdmin.role}, first_login: ${superAdmin.first_login}, active: ${superAdmin.is_active})\n`);

    // ─────────────────────────────────────────────
    // 2. KATEGORI POI + MATRIKS SKOR KERAMAIAN
    // ─────────────────────────────────────────────
    console.log("⏳ [3/5] Menyiapkan Kategori POI & Matriks Skor Keramaian Waktu (Likert 1-5)...");

    const poiCategories = [
      { name: "Hotel & Penginapan",                    score_pagi: 3, score_siang: 2, score_sore: 3, score_malam: 4 },
      { name: "Kafe & Kedai Kopi",                     score_pagi: 2, score_siang: 3, score_sore: 5, score_malam: 5 },
      { name: "Cepat Saji",                            score_pagi: 2, score_siang: 4, score_sore: 4, score_malam: 5 },
      { name: "Food Court",                            score_pagi: 2, score_siang: 5, score_sore: 4, score_malam: 5 },
      { name: "Restoran",                              score_pagi: 2, score_siang: 5, score_sore: 3, score_malam: 5 },
      { name: "Toko Minuman",                          score_pagi: 2, score_siang: 4, score_sore: 5, score_malam: 4 },
      { name: "Toko Roti & Kue",                       score_pagi: 3, score_siang: 3, score_sore: 4, score_malam: 3 },
      { name: "Minimarket",                            score_pagi: 3, score_siang: 4, score_sore: 4, score_malam: 4 },
      { name: "Supermarket",                           score_pagi: 2, score_siang: 4, score_sore: 4, score_malam: 4 },
      { name: "Mall / Pusat Perbelanjaan",             score_pagi: 2, score_siang: 4, score_sore: 5, score_malam: 5 },
      { name: "Pasar Tradisional",                     score_pagi: 5, score_siang: 4, score_sore: 2, score_malam: 1 },
      { name: "Perkantoran Komersial",                 score_pagi: 4, score_siang: 5, score_sore: 4, score_malam: 2 },
      { name: "Stasiun Kereta Api",                    score_pagi: 5, score_siang: 4, score_sore: 5, score_malam: 3 },
      { name: "Halte / Terminal Bus",                  score_pagi: 5, score_siang: 4, score_sore: 5, score_malam: 3 },
      { name: "Taman Kota / Terbuka",                  score_pagi: 4, score_siang: 2, score_sore: 5, score_malam: 4 },
      { name: "SPBU / Stasiun Pengisian Bahan Bakar",  score_pagi: 4, score_siang: 4, score_sore: 5, score_malam: 3 },
      { name: "Lainnya",                               score_pagi: 2, score_siang: 2, score_sore: 2, score_malam: 2 },
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
        [cat.name, cat.score_pagi, cat.score_siang, cat.score_sore, cat.score_malam]
      );
    }
    console.log(`   ✅ ${poiCategories.length} kategori POI berhasil disiapkan.\n`);

    // ─────────────────────────────────────────────
    // 3. 6 KRITERIA SPK STANDAR (BWM-TOPSIS)
    // ─────────────────────────────────────────────
    console.log("⏳ [4/5] Menyiapkan 6 Kriteria SPK Inti (C1-C6 BWM)...");

    const criteriasData = [
      { code: "C1", name: "Densitas POI", type: "BENEFIT", weight: 0.25, description: "Kepadatan titik keramaian potensial dalam zona" },
      { code: "C2", name: "Diversitas POI", type: "BENEFIT", weight: 0.20, description: "Keberagaman kategori titik keramaian dalam zona" },
      { code: "C3", name: "Keramaian Waktu", type: "BENEFIT", weight: 0.20, description: "Tingkat keramaian berbasis slot waktu operasional (Likert 1-5)" },
      { code: "C4", name: "Kondisi Cuaca", type: "COST", weight: 0.15, description: "Risiko presipitasi hujan real-time Open-Meteo API (%)" },
      { code: "C5", name: "Jarak Aksesibilitas", type: "COST", weight: 0.10, description: "Jarak geodesik asal ke centroid zona (KM)" },
      { code: "C6", name: "Tingkat Persaingan", type: "COST", weight: 0.10, description: "Indeks pembobotan ancaman kompetitor" },
    ];

    for (const c of criteriasData) {
      await client.query(
        `INSERT INTO criterias (code, name, type, is_active, weight, description)
         VALUES ($1, $2, $3::"CriteriaType", true, $4, $5)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           weight = EXCLUDED.weight,
           description = EXCLUDED.description;`,
        [c.code, c.name, c.type, c.weight, c.description]
      );
    }
    console.log(`   ✅ ${criteriasData.length} kriteria SPK berhasil disiapkan.\n`);

    // ─────────────────────────────────────────────
    // 4. SYSTEM SETTINGS DAY-0 (MOVA OFFICIAL)
    // ─────────────────────────────────────────────
    console.log("⏳ [5/5] Menyiapkan System Settings Day-0 (MOVA Baseline)...");

    const systemSettings = [
      { key: "SYSTEM_INITIALIZED",            value: "false",           description: "Status Inisialisasi Pertama Sistem — wajib selesaikan Onboarding" },
      { key: "SYSTEM_SETUP_CURRENT_STEP",      value: "1",               description: "Tahapan Wizard Inisialisasi Sistem saat ini" },
      { key: "SYSTEM_NAME",                   value: "MOVA",            description: "Nama Resmi Sistem Operasional" },
      { key: "APP_NAME",                      value: "MOVA — Mobile Operations & Visibility Application", description: "Nama identitas resmi sistem" },
      { key: "BUSINESS_NAME",                 value: "MOVA Operations", description: "Nama Bisnis Operasional" },
      { key: "CENTRAL_HUB_NAME",              value: "Central Hub MOVA", description: "Nama Gudang / Hub Pusat" },
      { key: "CENTRAL_HUB_LATITUDE",          value: "-6.200000",       description: "Latitude Pusat Operasional Hub" },
      { key: "CENTRAL_HUB_LONGITUDE",         value: "106.816666",      description: "Longitude Pusat Operasional Hub" },
      { key: "CENTRAL_HUB_ADDRESS",           value: "Gudang Pusat Operasional MOVA", description: "Alamat Fisik Gudang Hub" },
      { key: "OPERATING_HOURS_START",         value: "07:00",           description: "Jam Mulai Operasi Harian" },
      { key: "OPERATING_HOURS_END",           value: "21:00",           description: "Jam Selesai Operasi Harian" },
      { key: "OPERATIONAL_RADIUS_KM",         value: "12",              description: "Radius Maksimal Operasi dari Hub (KM)" },
      { key: "ARMADA_HOLD_DURATION_MINUTES",  value: "5",               description: "Batas durasi lock booking armada sementara bagi rider" },
      { key: "RESTRICTED_ROAD_PROXIMITY_METERS", value: "50",          description: "Jarak batas aman telemetri rider dari jalan protokol terlarang" },
      { key: "MAX_ZONE_CAPACITY_DEFAULT",     value: "3",               description: "Batas maksimal rider dalam 1 zona operasional secara default" },
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

    // ─────────────────────────────────────────────
    // 5. SPATIAL RESTRICTION LAYER (Jalan Protokol & Tol)
    // ─────────────────────────────────────────────
    console.log("⏳ [6/6] Menyiapkan Lapisan Spasial Restriksi Jalan Protokol & Tol (PostGIS)...");
    
    // 5a. Jalan Protokol
    const protocolPath = path.join(__dirname, "../../public/geojson/jalan_protokol.geojson");
    let protocolCount = 0;
    if (fs.existsSync(protocolPath)) {
      const rawData = fs.readFileSync(protocolPath, "utf8");
      const geoJson = JSON.parse(rawData);
      const features = geoJson.features || [];
      const validFeatures = [];

      for (let idx = 0; idx < features.length; idx++) {
        const feat = features[idx];
        if (feat.geometry?.type === "LineString" && Array.isArray(feat.geometry.coordinates)) {
          const externalId = feat.properties?.id || `way/gen-${idx + 1}`;
          const roadName = feat.properties?.name || "Jalan Protokol Utama";
          const highwayType = feat.properties?.highway || "secondary";
          const geoJsonStr = JSON.stringify(feat.geometry);

          validFeatures.push([
            externalId,
            roadName,
            highwayType,
            "PROHIBITED_ROAD",
            JSON.stringify(feat.properties || {}),
            geoJsonStr,
          ]);
        }
      }

      const batchSize = 200;
      for (let i = 0; i < validFeatures.length; i += batchSize) {
        const batch = validFeatures.slice(i, i + batchSize);
        const insertQuery = format(
          `
          INSERT INTO protocol_roads (external_id, name, highway_type, restriction_type, metadata, geom)
          SELECT 
            v.external_id,
            v.name,
            v.highway_type,
            v.restriction_type,
            v.metadata::jsonb,
            ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326)
          FROM (VALUES %L) AS v(external_id, name, highway_type, restriction_type, metadata, geojson)
          ON CONFLICT (external_id) DO UPDATE SET
            name = EXCLUDED.name,
            highway_type = EXCLUDED.highway_type,
            restriction_type = EXCLUDED.restriction_type,
            metadata = EXCLUDED.metadata,
            geom = EXCLUDED.geom,
            updated_at = CURRENT_TIMESTAMP;
          `,
          batch
        );
        await client.query(insertQuery);
      }
      protocolCount = validFeatures.length;
    }

    // 5b. Jalan Tol
    const tollPath = path.join(__dirname, "../../public/geojson/jalan_tol.geojson");
    let tollCount = 0;
    if (fs.existsSync(tollPath)) {
      const rawData = fs.readFileSync(tollPath, "utf8");
      const geoJson = JSON.parse(rawData);
      const features = geoJson.features || [];
      const validTollFeatures = [];

      for (let idx = 0; idx < features.length; idx++) {
        const feat = features[idx];
        if (feat.geometry?.type === "LineString" && Array.isArray(feat.geometry.coordinates)) {
          const externalId = feat.properties?.id || `way/toll-${idx + 1}`;
          const roadName = feat.properties?.name || "Jalan Tol";
          const highwayType = feat.properties?.highway || "motorway";
          const geoJsonStr = JSON.stringify(feat.geometry);

          validTollFeatures.push([
            externalId,
            roadName,
            highwayType,
            "PROHIBITED_TOLL_ROAD",
            JSON.stringify(feat.properties || {}),
            geoJsonStr,
          ]);
        }
      }

      const batchSize = 200;
      for (let i = 0; i < validTollFeatures.length; i += batchSize) {
        const batch = validTollFeatures.slice(i, i + batchSize);
        const insertQuery = format(
          `
          INSERT INTO protocol_roads (external_id, name, highway_type, restriction_type, metadata, geom)
          SELECT 
            v.external_id,
            v.name,
            v.highway_type,
            v.restriction_type,
            v.metadata::jsonb,
            ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326)
          FROM (VALUES %L) AS v(external_id, name, highway_type, restriction_type, metadata, geojson)
          ON CONFLICT (external_id) DO UPDATE SET
            name = EXCLUDED.name,
            highway_type = EXCLUDED.highway_type,
            restriction_type = EXCLUDED.restriction_type,
            metadata = EXCLUDED.metadata,
            geom = EXCLUDED.geom,
            updated_at = CURRENT_TIMESTAMP;
          `,
          batch
        );
        await client.query(insertQuery);
      }
      tollCount = validTollFeatures.length;
    }

    console.log(`   ✅ Lapisan Restriksi Spasial disiapkan: ${protocolCount} jalan protokol & ${tollCount} jalan tol.\n`);

    await client.query("COMMIT");

    console.log("════════════════════════════════════════════════════════════");
    console.log("🎉  FRESH ONBOARDING SEED SELESAI (Single-Tenant Ready)");
    console.log("════════════════════════════════════════════════════════════");
    console.log("");
    console.log("  Akun Root Super Admin Day-0:");
    console.log("  📧  Email       : superadmin@kopikeliling.com");
    console.log("  🔑  Password    : password123  (sementara)");
    console.log("  ⚡  first_login : true  ← akan dicegat diarahkan ke /first-login");
    console.log("");
    console.log("  Alur Onboarding Selanjutnya:");
    console.log("  1. Buka Frontend di http://localhost:8074");
    console.log("  2. Login dengan kredensial default di atas");
    console.log("  3. Selesaikan form /first-login untuk mengubah kata sandi permanen");
    console.log("  4. Masuk ke Dashboard / Manajemen Pengguna (/users) untuk mengundang Management");
    console.log("════════════════════════════════════════════════════════════\n");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed fresh gagal (ROLLBACK):", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed-fresh.js")) {
  seedFresh();
}

export { seedFresh };
