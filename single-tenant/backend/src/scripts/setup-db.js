/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   Full Database Reset, Migration, Seeding & Overpass Data Synchronization Script
 */

import { pool } from "../config/database.js";
import { execSync } from "child_process";
import { syncCityPoisService } from "../services/poiService.js";
import { syncProtocolRoadsService } from "../services/roadService.js";

async function runFullSetup() {
  console.log("==================================================");
  console.log("🚀 MEMULAI PROSES FULL DATABASE RESET, MIGRATIONS & DATA SYNC");
  console.log("==================================================\n");

  try {
    // 1. Reset Database
    console.log("1️⃣  Langkah 1: Mengosongkan Database (db:reset)...");
    execSync("node src/scripts/reset-db.js", { stdio: "inherit" });

    // 2. Migrate Schema
    console.log("\n2️⃣  Langkah 2: Menjalankan Migrasi Schema (db:migrate)...");
    execSync("node src/scripts/migrate.js", { stdio: "inherit" });

    // 3. Seed Initial Master Data
    console.log("\n3️⃣  Langkah 3: Menjalankan Seeding Master Data (db:seed)...");
    execSync("node src/scripts/seed.js", { stdio: "inherit" });

    // 4. Full-City POI Master Data Sync
    console.log("\n4️⃣  Langkah 4: Sinkronisasi Otomatis Master Data POI Skala Kota (Overpass API)...");
    const poiResult = await syncCityPoisService();
    console.log(`✅ Status POI Kota: ${poiResult.message}`);
    console.log(`📊 Total Master Data POI Disimpan di Database: ${poiResult.count}`);

    // 5. Protocol Roads Seeding (PostGIS)
    console.log("\n5️⃣  Langkah 5: Seeding Data Spasial Jalan Protokol (PostGIS)...");
    execSync("node src/scripts/seed-protocol-roads.js", { stdio: "inherit" });
    const roadResult = await syncProtocolRoadsService();
    console.log(`✅ Status Jalan Protokol: ${roadResult.msg}`);
    console.log(`🛣️  Total Fitur Jalan Protokol di PostGIS: ${roadResult.totalRoads}`);

    // 6. Toll Roads Sync (Overpass API - Non-Blocking)
    console.log("\n6️⃣  Langkah 6: Sinkronisasi Otomatis Jalan Tol (Overpass API - Non-Blocking)...");
    try {
      execSync("node src/scripts/sync-toll-roads.js", { stdio: "inherit" });
    } catch (tollErr) {
      console.warn("⚠️  [Non-Blocking] Sinkronisasi Jalan Tol via Overpass API dilewati / gagal:", tollErr.message);
    }

    console.log("\n==================================================");
    console.log("🎉 SELURUH PROSES DB RESET, MIGRATIONS & AUTOMATIC DATA SYNC SELESAI SUKSES!");
    console.log("==================================================\n");

  } catch (error) {
    console.error("\n💥 Gagal menjalankan Full DB Setup & Sync:", error.message);
  } finally {
    await pool.end();
  }
}

runFullSetup();
