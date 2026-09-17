/*
 * sync-poi.ts
 * Master POI City-Scale Synchronization & PostGIS Spatial DSS Evaluation Script (Bun + TypeScript)
 */

import { pool } from "../config/database.js";
import { ZoneModel } from "../models/zoneModel.js";
import {
  syncCityPoisService,
  getPoisByZoneService,
  getDensitasDanDiversitasC1C2Service,
  syncAllZonesWeatherService,
} from "../services/poiService.js";

async function runSyncPoi() {
  console.log("==================================================");
  console.log("🚀 Memulai penarikan Master Data POI skala 1 kota (Overpass API)...");
  console.log("==================================================\n");

  try {
    // 1. Full City Master Data POI Sync
    const cityResult = await syncCityPoisService();
    console.log(`\n==================================================`);
    console.log(`✅ Status: ${cityResult.message}`);
    console.log(`🏙️  Kota Hub: ${cityResult.city}`);
    console.log(`📊 Total Master Data POI Terdaftar di DB: ${cityResult.count}`);
    console.log(`==================================================\n`);

    // 2. Dynamic PostGIS Spatial DSS Evaluation for existing zones
    const zones = await ZoneModel.findAll();
    console.log(`📌 Memproses evaluasi SPK Spasial PostGIS untuk ${zones.length} zona...`);

    for (const zone of zones) {
      console.log(`\n--------------------------------------------------`);
      console.log(`📍 Evaluasi PostGIS ST_Contains Zona: "${zone.name}" (ID: ${zone.id})...`);

      try {
        const poisInZone = await getPoisByZoneService(zone.id);
        const dssScores = await getDensitasDanDiversitasC1C2Service(zone.id);

        console.log(`📊 Jumlah POI Terdeteksi di Polygon Zona: ${poisInZone.length}`);
        console.log(`📈 Hasil Perhitungan SPK Spasial PostGIS:`);
        console.log(`   - C1 (Densitas POI)  : ${dssScores.C1_densitas}`);
        console.log(`   - C2 (Diversitas POI): ${dssScores.C2_diversitas}`);
      } catch (err: any) {
        console.error(`❌ Gagal evaluasi PostGIS zona "${zone.name}":`, err.message);
      }
    }

    // 3. Sync Weather for all zones
    console.log("\n🌤️  Menjalankan sinkronisasi cuaca Open-Meteo untuk seluruh zona...");
    try {
      const weatherRes = await syncAllZonesWeatherService();
      console.log(`✅ Weather Sync Selesai: ${Array.isArray(weatherRes) ? `${weatherRes.length} zona` : "OK"}`);
    } catch (wErr: any) {
      console.warn("⚠️ Weather Sync warning:", wErr.message);
    }

    console.log(`\n==================================================`);
    console.log("🎉 Proses Sinkronisasi Kota & Evaluasi Spasial Selesai!");
    console.log(`==================================================\n`);
  } catch (error: any) {
    console.error("💥 Terjadi kesalahan saat menjalankan sinkronisasi POI Kota:", error.message);
  } finally {
    await pool.end();
  }
}

runSyncPoi();
