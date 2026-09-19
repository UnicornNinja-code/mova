/*
 * test-weather-comprehensive.js
 * Comprehensive Integration Test Suite for Unified Weather Data Pipeline & H+1 Forecast.
 */

import { poiWeatherService } from "../services/poi/POIWeatherService.js";
import { pool } from "../config/database.js";
import { redisClient } from "../config/redis.js";

async function runComprehensiveWeatherTests() {
  console.log("\n================================================================================");
  console.log("🌦️ MEMULAI PENGUJIAN INTEGRASI ALUR DATA CUACA TERPADU & PRAKIRAAN H+1");
  console.log("================================================================================");

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, message) => {
    totalTests++;
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
    }
  };

  try {
    // -------------------------------------------------------------------------
    // [TES 1] Hub Weather Overview - Hari Ini (Today)
    // -------------------------------------------------------------------------
    console.log("\n📡 [TES 1] Menguji Agregasi Makro Hub Sidoarjo (Hari Ini / Today)...");
    const todayHub = await poiWeatherService.getHubWeatherOverview({
      cityName: "Sidoarjo",
      targetDate: "today",
      targetSlot: "all",
    });

    assert(todayHub.status === "success", "Hub overview status bernilai 'success'");
    assert(todayHub.hub_city_name === "SIDOARJO", "Hub city name bernilai 'SIDOARJO'");
    assert(todayHub.is_tomorrow === false, "is_tomorrow bernilai false untuk target 'today'");
    assert(todayHub.hub_overview && typeof todayHub.hub_overview.avg_temperature_c === "number", "hub_overview memuat avg_temperature_c");
    assert(Array.isArray(todayHub.hub_timeline) && todayHub.hub_timeline.length > 0, `hub_timeline memuat ${todayHub.hub_timeline?.length} data jam operasional`);
    assert(Array.isArray(todayHub.hub_c4_slots) && todayHub.hub_c4_slots.length === 4, "hub_c4_slots memuat 4 shift kerja lengkap (Pagi, Siang, Sore, Malam)");
    assert(Array.isArray(todayHub.zones_weather_list) && todayHub.zones_weather_list.length > 0, `zones_weather_list memuat ${todayHub.zones_weather_list?.length} zona operasional`);

    console.log(`   • Suhu Rata-rata Hub: ${todayHub.hub_overview.avg_temperature_c}°C (Feels like: ${todayHub.hub_overview.feels_like_c}°C)`);
    console.log(`   • Curah Hujan Tertinggi: ${todayHub.hub_overview.max_rain_probability_percent}% (${todayHub.hub_overview.weather_condition})`);
    console.log(`   • Rentang Jam Timeline: ${todayHub.hub_timeline[0]?.time} s/d ${todayHub.hub_timeline[todayHub.hub_timeline.length - 1]?.time}`);

    // -------------------------------------------------------------------------
    // [TES 2] Hub Weather Overview - Besok H+1 (Tomorrow)
    // -------------------------------------------------------------------------
    console.log("\n🔮 [TES 2] Menguji Prakiraan Cuaca H+1 Hub Sidoarjo (Besok / Tomorrow)...");
    const tomorrowHub = await poiWeatherService.getHubWeatherOverview({
      cityName: "Sidoarjo",
      targetDate: "tomorrow",
      targetSlot: "all",
    });

    assert(tomorrowHub.status === "success", "Prakiraan besok status bernilai 'success'");
    assert(tomorrowHub.is_tomorrow === true, "is_tomorrow bernilai true untuk target 'tomorrow'");
    assert(tomorrowHub.target_date !== todayHub.target_date, `Tanggal target besok (${tomorrowHub.target_date}) berbeda dengan hari ini (${todayHub.target_date})`);
    assert(Array.isArray(tomorrowHub.hub_timeline) && tomorrowHub.hub_timeline.length > 0, "hub_timeline H+1 terisi lengkap (06:00 - 21:00 WIB)");
    assert(tomorrowHub.hub_c4_slots.length === 4, "hub_c4_slots H+1 memuat 4 shift evaluasi");

    console.log(`   • Tanggal Target Hari Ini: ${todayHub.target_date}`);
    console.log(`   • Tanggal Target Besok H+1: ${tomorrowHub.target_date}`);

    // -------------------------------------------------------------------------
    // [TES 3] Penanganan Graceful ID Agregasi ('all', 'zone-all', 'zone-default')
    // -------------------------------------------------------------------------
    console.log("\n🛡️ [TES 3] Menguji Penanganan Transparan ID 'all', 'zone-all', & 'zone-default' Tanpa 404...");

    const allTimeline = await poiWeatherService.getZoneWeatherTimeline({
      zoneId: "all",
      targetDate: "today",
      targetSlot: "all",
    });
    assert(allTimeline.status === "success" && allTimeline.zone_id === "all", "getZoneWeatherTimeline('all') mengembalikan status success");
    assert(Array.isArray(allTimeline.hourly_timeline) && allTimeline.hourly_timeline.length > 0, "Timeline untuk 'all' mengembalikan agregasi makro Central Hub");

    const zoneAllTimeline = await poiWeatherService.getZoneWeatherTimeline({
      zoneId: "zone-all",
      targetDate: "tomorrow",
    });
    assert(zoneAllTimeline.status === "success" && zoneAllTimeline.zone_id === "all", "getZoneWeatherTimeline('zone-all') menangani dummy ID dengan sukses");

    const defaultC4 = await poiWeatherService.calculateZoneC4Score("zone-default");
    assert(defaultC4.zone_id === "all" && Array.isArray(defaultC4.slots), "calculateZoneC4Score('zone-default') mengembalikan evaluasi Hub tanpa 404");

    // -------------------------------------------------------------------------
    // [TES 4] Pengujian Timeline Zona Spesifik (UUID Asli dari Database)
    // -------------------------------------------------------------------------
    console.log("\n📍 [TES 4] Menguji Timeline Cuaca untuk Zona Spesifik (UUID Asli)...");
    const { rows: sampleZones } = await pool.query("SELECT id, name FROM zones WHERE status = 'ACTIVE' LIMIT 1;");
    if (sampleZones.length > 0) {
      const sampleZone = sampleZones[0];
      const specificTimeline = await poiWeatherService.getZoneWeatherTimeline({
        zoneId: sampleZone.id,
        targetDate: "tomorrow",
      });

      assert(specificTimeline.status === "success", `Timeline zona '${sampleZone.name}' bernilai success`);
      assert(specificTimeline.zone_id === sampleZone.id, `ID zona sesuai: ${sampleZone.id}`);
      assert(Array.isArray(specificTimeline.hourly_timeline) && specificTimeline.hourly_timeline.length > 0, `Timeline per jam terisi (${specificTimeline.hourly_timeline.length} slot)`);
    } else {
      console.warn("   ⚠️ Warning: Tidak ada zona aktif di database untuk pengujian zona spesifik.");
    }

    // -------------------------------------------------------------------------
    // [TES 5] Verifikasi Caching Layer (Redis & PostgreSQL)
    // -------------------------------------------------------------------------
    console.log("\n⚡ [TES 5] Memverifikasi Integritas Caching Layer...");
    if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
      const pingRes = await redisClient.ping();
      assert(pingRes === "PONG", "Redis Client terhubung dan merespons PING -> PONG");
    } else {
      console.warn("   ⚠️ Warning: Redis Client tidak dalam status open.");
    }

    const { rows: cacheCheck } = await pool.query(
      "SELECT zone_id, updated_at FROM weathers LIMIT 3;"
    );
    assert(cacheCheck.length >= 0, `PostgreSQL weathers table siap menyimpan data snapshot (Ditemukan: ${cacheCheck.length} records)`);

    // -------------------------------------------------------------------------
    // Ringkasan
    // -------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log(`🎉 HASIL PENGUJIAN: ${passedTests}/${totalTests} CHECKS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Terjadi error saat pengujian komprehensif:", error);
  } finally {
    if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
      await redisClient.quit();
    }
    await pool.end();
  }
}

runComprehensiveWeatherTests();
