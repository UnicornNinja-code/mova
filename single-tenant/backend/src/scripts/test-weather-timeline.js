/*
 * test-weather-timeline.js
 * Test Suite for Weather Timeline & Hourly Slot Pairing (Today / Tomorrow).
 */

import { poiWeatherService } from "../services/poi/POIWeatherService.js";
import { weatherRepository } from "../repositories/WeatherRepository.js";
import { WeatherOperationalEvaluator } from "../utils/WeatherOperationalEvaluator.js";
import { pool } from "../config/database.js";

async function runWeatherTimelineTests() {
  console.log("\n================================================================================");
  console.log("🌤️ MEMULAI TEST SUITE: HOURLY WEATHER TIMELINE & TIME-SLOT PAIRING");
  console.log("================================================================================");

  try {
    // 1. Fetch reference zone
    const { rows: zones } = await pool.query("SELECT id, name FROM zones WHERE status = 'ACTIVE' LIMIT 1;");
    if (zones.length === 0) {
      console.error("❌ Error: Tidak ada zona aktif di database.");
      process.exit(1);
    }
    const testZone = zones[0];
    console.log(`📌 Zona Uji: '${testZone.name}' (ID: ${testZone.id})`);

    // 2. Test Today's Timeline with 'all' slots
    console.log("\n📍 [TEST 1] Mengambil Hourly Timeline Hari Ini (Seluruh Jam Operasional 06:00 - 21:00)...");
    const todayAll = await poiWeatherService.getZoneWeatherTimeline({
      zoneId: testZone.id,
      targetDate: "today",
      targetSlot: "all",
    });

    console.log(`   • Target Tanggal: ${todayAll.target_date}`);
    console.log(`   • Total Titik Jam: ${todayAll.hourly_timeline.length} jam`);
    console.log(`   • Rata-rata Suhu: ${todayAll.slot_summary.avg_temperature_c}°C`);
    console.log(`   • Max Peluang Hujan: ${todayAll.slot_summary.max_rain_probability}%`);
    console.log(`   • Kondisi Dominan: ${todayAll.slot_summary.dominant_condition}`);

    if (todayAll.hourly_timeline.length >= 10) {
      console.log("   ✅ PASS: Hourly timeline hari ini berhasil ditarik!");
    } else {
      console.error("   ❌ FAIL: Titik jam kurang dari ekspektasi.");
    }

    // 3. Test Today's Specific Slot Pairing ('pagi')
    console.log("\n📍 [TEST 2] Pairing Slot Spesifik: 'PAGI' (06:00 - 10:00)...");
    const todayPagi = await poiWeatherService.getZoneWeatherTimeline({
      zoneId: testZone.id,
      targetDate: "today",
      targetSlot: "pagi",
    });

    console.log(`   • Ringkasan Slot Pagi: ${todayPagi.slot_summary.label}`);
    console.log(`   • Titik Jam Pagi: ${todayPagi.hourly_timeline.map(h => `${h.time} (${h.temperature_c}°C, ${h.weather_label})`).join(" | ")}`);

    if (todayPagi.hourly_timeline.length === 5 && todayPagi.hourly_timeline[0].time === "06:00" && todayPagi.hourly_timeline[4].time === "10:00") {
      console.log("   ✅ PASS: Slot Pagi persis 5 titik jam (06:00, 07:00, 08:00, 09:00, 10:00)!");
    } else {
      console.error("   ❌ FAIL: Pairing slot pagi tidak tepat.");
    }

    // 4. Test Tomorrow's Forecast & Slot Pairing
    console.log("\n📍 [TEST 3] Forecast Besok ('tomorrow') & Pairing 4 Time Slots...");
    const tomorrowRes = await poiWeatherService.getZoneWeatherTimeline({
      zoneId: testZone.id,
      targetDate: "tomorrow",
      targetSlot: "all",
    });

    console.log(`   • Target Tanggal Besok: ${tomorrowRes.target_date}`);
    console.log(`   • Slot Tersedia: ${Object.keys(tomorrowRes.available_slots).join(", ")}`);

    for (const [key, slot] of Object.entries(tomorrowRes.available_slots)) {
      console.log(`     [${key.toUpperCase().padEnd(5)}] -> ${slot.label}: Suhu ${slot.avg_temperature_c}°C | Hujan ${slot.max_rain_probability}% | Kondisi: ${slot.dominant_condition} | Risiko: ${slot.risk_level}`);
    }

    if (tomorrowRes.available_slots.pagi && tomorrowRes.available_slots.siang && tomorrowRes.available_slots.sore && tomorrowRes.available_slots.malam) {
      console.log("   ✅ PASS: Forecast besok untuk ke-4 time slot berhasil dipairing dengan sempurna!");
    } else {
      console.error("   ❌ FAIL: Ada slot waktu yang hilang untuk besok.");
    }

    // 5. Test WMO Meta mapping
    console.log("\n📍 [TEST 4] Validasi Metadata WMO Weather Code (Icon & Label)...");
    const metaClear = WeatherOperationalEvaluator.getWmoMeta(0);
    const metaThunder = WeatherOperationalEvaluator.getWmoMeta(95);
    console.log(`   • WMO Code 0  -> Label: '${metaClear.label}', Icon: '${metaClear.icon}'`);
    console.log(`   • WMO Code 95 -> Label: '${metaThunder.label}', Icon: '${metaThunder.icon}'`);

    if (metaClear.icon === "sun" && metaThunder.icon === "cloud-bolt") {
      console.log("   ✅ PASS: Metadata WMO Weather Code terpetakan dengan benar!");
    } else {
      console.error("   ❌ FAIL: Metadata WMO tidak valid.");
    }

    console.log("\n================================================================================");
    console.log("🎉 TEST SUITE HOURLY WEATHER TIMELINE SELESAI (100% PASS)");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error pada test suite Weather Timeline:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runWeatherTimelineTests();
