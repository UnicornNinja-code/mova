/*
 * setup-db.ts
 * Full Database Reset, Migration, Seeding & Overpass Data Synchronization Script in TypeScript
 */

import { pool } from "../config/database.js";
import { execSync } from "child_process";
import { syncProtocolRoadsService } from "../services/roadService.js";

async function runFullSetup() {
  console.log("==================================================");
  console.log("🚀 MEMULAI PROSES FULL DATABASE RESET, MIGRATIONS & DATA SYNC (BUN + TS)");
  console.log("==================================================\n");

  try {
    // 1. Reset Database
    console.log("1️⃣  Langkah 1: Mengosongkan Database (db:reset)...");
    execSync("bun src/scripts/reset-db.ts", { stdio: "inherit" });

    // 2. Migrate Schema
    console.log("\n2️⃣  Langkah 2: Menjalankan Migrasi Schema (db:migrate)...");
    execSync("bun src/scripts/migrate.ts", { stdio: "inherit" });

    // 3. Seed Initial Master Data
    console.log("\n3️⃣  Langkah 3: Menjalankan Seeding Master Data (db:seed)...");
    execSync("bun src/scripts/seed.ts", { stdio: "inherit" });

    // 4. Full-City POI Master Data Sync & PostGIS Evaluation
    console.log("\n4️⃣  Langkah 4: Sinkronisasi Master Data POI (Overpass API) & Evaluasi PostGIS...");
    try {
      execSync("bun src/scripts/sync-poi.ts", { stdio: "inherit" });
    } catch (poiErr: any) {
      console.warn("⚠️  [Non-Blocking Warning] Sinkronisasi POI Overpass API:", poiErr.message);
    }

    // 5. Protocol Roads Seeding (PostGIS)
    console.log("\n5️⃣  Langkah 5: Seeding Data Spasial Jalan Protokol (PostGIS)...");
    execSync("bun src/scripts/seed-protocol-roads.ts", { stdio: "inherit" });
    try {
      const roadResult = await syncProtocolRoadsService();
      console.log(`✅ Status Jalan Protokol: ${roadResult.msg}`);
      console.log(`🛣️  Total Fitur Jalan Protokol di PostGIS: ${roadResult.totalRoads}`);
    } catch (rErr: any) {
      console.warn("⚠️  Peringatan Sinkronisasi Jalan Protokol:", rErr.message);
    }

    // 6. Toll Roads Sync (Overpass API - Non-Blocking)
    console.log("\n6️⃣  Langkah 6: Sinkronisasi Otomatis Jalan Tol (Overpass API - Non-Blocking)...");
    try {
      execSync("bun src/scripts/sync-toll-roads.ts", { stdio: "inherit" });
    } catch (tollErr: any) {
      console.warn("⚠️  [Non-Blocking] Sinkronisasi Jalan Tol via Overpass API dilewati / gagal:", tollErr.message);
    }

    // 7. Weather Sync for All Zones
    console.log("\n7️⃣  Langkah 7: Sinkronisasi Data Cuaca Multi-Zona (Open-Meteo API)...");
    try {
      execSync("bun src/scripts/fetch-weather.ts", { stdio: "inherit" });
    } catch (wErr: any) {
      console.warn("⚠️  [Non-Blocking] Sinkronisasi Cuaca dilewati:", wErr.message);
    }

    console.log("\n==================================================");
    console.log("🎉 SELURUH PROSES DB RESET, MIGRATIONS & AUTOMATIC DATA SYNC SELESAI SUKSES!");
    console.log("==================================================\n");

  } catch (error: any) {
    console.error("\n💥 Gagal menjalankan Full DB Setup & Sync:", error.message);
  } finally {
    await pool.end();
  }
}

runFullSetup();
