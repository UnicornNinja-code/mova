/*
 * fetch-weather.js
 * Manual CLI Script for Fetching Live Open-Meteo Weather Forecast for All Active Zones.
 */

import { poiWeatherService } from "../services/poi/POIWeatherService.js";
import { weatherRepository } from "../repositories/WeatherRepository.js";
import { TimeSlotEvaluator } from "../utils/TimeSlotEvaluator.js";

async function fetchZoneWeatherManual() {
  console.log("\n================================================================================");
  console.log("🌤️ [MANUAL OPEN-METEO WEATHER FETCH] PEMINDAIAN DATA CUACA ZONA OPERASIONAL");
  console.log("================================================================================");

  try {
    // 1. Fetch Zone Centroids from Database
    const centroids = await weatherRepository.getAllZoneCentroids();
    console.log(`📌 Ditemukan ${centroids.length} Zona Operasional Aktif di Database.\n`);

    if (centroids.length === 0) {
      console.log("⚠️ Tidak ada zona aktif di database. Harap jalankan 'npm run db:seed' terlebih dahulu.");
      process.exit(0);
    }

    // 2. Perform Batch Open-Meteo Sync
    console.log("⏳ Menghubungi API Open-Meteo (Single Batch HTTP Request)...");
    await poiWeatherService.syncAllZonesWeather(true);

    // 3. Display Detailed Weather Information & C4 Scores per Zone
    const slots = ["pagi", "siang", "sore", "malam"];

    for (let i = 0; i < centroids.length; i++) {
      const zone = centroids[i];
      console.log("\n--------------------------------------------------------------------------------");
      console.log(`📍 [ZONA ${i + 1}] ${zone.name.toUpperCase()} (ID: ${zone.zone_id})`);
      console.log(`📍 Koordinat Centroid : Lat ${zone.latitude.toFixed(6)}, Lon ${zone.longitude.toFixed(6)}`);
      console.log("--------------------------------------------------------------------------------");

      // Fetch C4 Score for each time slot
      for (const slot of slots) {
        const c4Res = await poiWeatherService.calculateZoneC4Score(zone.zone_id, slot);
        const supporting = c4Res.supporting_info || {};

        console.log(`   🕒 Slot [${slot.toUpperCase().padEnd(5)}] -> Skor C4 (Max Hujan %): ${c4Res.max_precipitation_probability.toString().padStart(3)}% | Rata-Rata Hujan: ${c4Res.avg_precipitation_probability.toFixed(1).padStart(5)}% | Vol Air: ${supporting.rain?.toFixed(2) || '0.00'}mm | Suhu: ${supporting.temperature?.toFixed(1) || '0.0'}°C | Angin: ${supporting.wind_speed?.toFixed(1) || '0.0'}km/h`);
      }
    }

    console.log("\n================================================================================");
    console.log("🎉 Manual Weather Sync Berhasil Selesai & Tersimpan di Database Cache!");
    console.log("================================================================================");
  } catch (error) {
    console.error("💥 Gagal mengambil data cuaca Open-Meteo:", error.message || error);
  } finally {
    process.exit(0);
  }
}

fetchZoneWeatherManual();
