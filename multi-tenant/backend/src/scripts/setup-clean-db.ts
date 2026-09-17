/*
 * setup-clean-db.ts
 * Clean & Fast Database Reset, Latest Schema Migration (001-007), and Master Seeding
 *
 * Menjalankan urutan inisialisasi awal database secara bersih:
 * 1. Drop seluruh tabel transaksional, master, dan ENUM (preservasi PostGIS spatial_ref_sys)
 * 2. Migrasi skema utama (schema.sql) + seluruh file migrasi (001 s/d 007)
 * 3. Seeding data master operasional (Superadmin, Management, Supervisor, Riders, Kriteria, Produk, Armada, Zona)
 * 4. Seeding data spasial jalan protokol
 */

import { execSync } from "child_process";
import { pool } from "../config/database.js";
import { syncProtocolRoadsService } from "../services/roadService.js";

async function runCleanSetup() {
  console.log("================================================================================");
  console.log("🚀 MEMULAI CLEAN DATABASE SETUP (DROP DB -> LATEST MIGRATIONS -> SEEDING)");
  console.log("================================================================================\n");

  const startTime = performance.now();

  try {
    // 1. Drop Database & ENUMs
    console.log("1️⃣  [LANGKAH 1] Mengosongkan Database (Drop all tables & ENUMs)...");
    execSync("bun src/scripts/reset-db.ts", { stdio: "inherit" });

    // 2. Run Master Schema + All Migrations (001-008)
    console.log("\n2️⃣  [LANGKAH 2] Menjalankan Skema Terbaru & Migrasi (001 - 008)...");
    execSync("bun src/scripts/migrate.ts", { stdio: "inherit" });

    // 3. Seed Initial Master Data
    console.log("\n3️⃣  [LANGKAH 3] Menjalankan Seeding Master Data (RBAC, Produk, Armada, DSS)...");
    execSync("bun src/scripts/seed.ts", { stdio: "inherit" });

    // 4. Seed Protocol & Toll Roads (PostGIS)
    console.log("\n4️⃣  [LANGKAH 4] Menyiapkan Lapisan Spasial Jalan Protokol & Tol (PostGIS)...");
    execSync("bun src/scripts/seed-protocol-roads.ts", { stdio: "inherit" });
    execSync("bun src/scripts/seed-toll-roads.ts", { stdio: "inherit" });

    try {
      const roadResult = await syncProtocolRoadsService();
      console.log(` ✅ Status Jalan Protokol: ${roadResult.msg} (${roadResult.totalRoads} ruas)`);
    } catch (rErr: any) {
      console.warn(" ⚠️ Peringatan Jalan Protokol:", rErr.message);
    }

    const duration = Math.round(performance.now() - startTime);

    console.log("\n================================================================================");
    console.log(`🎉 SETUP DATABASE BERHASIL SELESAI DALAM ${duration}ms!`);
    console.log("================================================================================");
    console.log(" Akun Root Siap Digunakan (Sistem dalam Kondisi Benar-Benar Fresh):");
    console.log("  • Super Admin : superadmin@kopikeliling.com (Kata Sandi: password123)");
    console.log("  • Data Transaksi : Kosong (Rp 0 Omzet, Siap Operasi Perdana)");
    console.log("  • Staf & Rider   : Kosong (Siap Diuji Melalui Alur Onboarding / Undangan)");
    console.log("================================================================================\n");
  } catch (error: any) {
    console.error("\n💥 Gagal menjalankan Clean Setup Database:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCleanSetup();
