/*
 * part06_weather.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 06:
 * Open-Meteo Weather Service, PostGIS Zone Centroid Calculations,
 * Non-Destructive Historical Weather Retention (ADR-003), and C4 Weather Risk Scoring.
 */

import { pool } from "../src/config/database.js";
import { weatherRepository } from "../src/repositories/WeatherRepository.js";
import { poiWeatherService } from "../src/services/poi/POIWeatherService.js";
import { zoneService } from "../src/services/zoneService.js";
import { ZoneModel } from "../src/models/zoneModel.js";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runPart06Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 06: WEATHER SERVICE & HISTORICAL TESTS");
  console.log("========================================================\n");

  const testSuffix = Date.now();
  let testZoneId: string | number = "";

  // -------------------------------------------------------------
  // SETUP: Pre-cleanup and create a temporary test zone
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM weathers WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'Weather Test Zone%');");
    await pool.query("DELETE FROM zones WHERE name LIKE 'Weather Test Zone%';");
  } catch (e) {}

  const createdZone = await zoneService.createZone({
    name: `Weather Test Zone ${testSuffix}`,
    max_capacity: 5,
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [112.7480, -7.2650],
          [112.7550, -7.2650],
          [112.7550, -7.2720],
          [112.7480, -7.2720],
          [112.7480, -7.2650],
        ],
      ],
    },
  });
  testZoneId = createdZone.id;

  // -------------------------------------------------------------
  // GROUP 1: PostGIS Zone Centroid Calculation (WEATHER-007)
  // -------------------------------------------------------------
  console.log("📍 [GROUP 1] PostGIS ST_Centroid Zone Coordinates Calculation");

  const centroid = await weatherRepository.getZoneCentroid(testZoneId);
  assert(centroid !== null, "TEST 1.1: PostGIS ST_Centroid calculates zone centroid");
  assert(centroid!.latitude < -7.0 && centroid!.latitude > -7.5, "TEST 1.2: Centroid latitude is inside Surabaya region");
  assert(centroid!.longitude > 112.5 && centroid!.longitude < 113.0, "TEST 1.3: Centroid longitude is inside Surabaya region");

  // -------------------------------------------------------------
  // GROUP 2: Non-Destructive Weather Cache Retention (WEATHER-002, WEATHER-003, ADR-003)
  // -------------------------------------------------------------
  console.log("\n💾 [GROUP 2] Non-Destructive Append-Only Weather Retention (ADR-003)");

  // Observation 1: Morning Sunny (28°C, 0mm rain)
  const obs1 = await weatherRepository.saveCachedWeather(testZoneId, {
    max_precipitation_probability: 10,
    precipitation: 0.0,
    supporting_info: {
      temperature: 28.5,
      humidity: 70,
      dew_point: 22.0,
      rain: 0.0,
      weather_code: 1, // Mainly clear
    },
  });
  assert(obs1 && typeof obs1.id !== "undefined", "TEST 2.1: First weather observation saved successfully");

  // Observation 2: Afternoon Rain (25°C, 15mm rain)
  const obs2 = await weatherRepository.saveCachedWeather(testZoneId, {
    max_precipitation_probability: 85,
    precipitation: 15.2,
    supporting_info: {
      temperature: 25.0,
      humidity: 92,
      dew_point: 23.5,
      rain: 15.2,
      weather_code: 63, // Rain moderate
    },
  });
  assert(obs2 && typeof obs2.id !== "undefined", "TEST 2.2: Second weather observation saved successfully");

  // Verify non-destructive append-only storage (both records must exist in table)
  const { rows: allObs } = await pool.query("SELECT * FROM weathers WHERE zone_id = $1 ORDER BY updated_at ASC;", [testZoneId]);
  assert(allObs.length >= 2, `TEST 2.3: Historical retention active (Found ${allObs.length} records, no DELETE occurred)`);

  // Verify latest observation retrieved via ORDER BY updated_at DESC LIMIT 1
  const cachedLatest = await weatherRepository.getCachedWeather(testZoneId, 60);
  assert(cachedLatest !== null, "TEST 2.4: getCachedWeather retrieves active weather record");
  assert(parseFloat(cachedLatest.rain) === 15.2, "TEST 2.5: Latest weather observation matches the most recent entry (15.2mm)");

  // -------------------------------------------------------------
  // GROUP 3: Live Hub Weather & C4 Risk Score Evaluation (WEATHER-001, WEATHER-005, WEATHER-006)
  // -------------------------------------------------------------
  console.log("\n🌤️ [GROUP 3] Open-Meteo Live Hub Weather & C4 Risk Scoring");

  const c4Score = await poiWeatherService.calculateZoneC4Score(testZoneId);
  assert(c4Score && typeof c4Score.skor_c4 === "number", "TEST 3.1: Zone C4 score evaluation returns numeric score");
  assert(c4Score.skor_c4 >= 0 && c4Score.skor_c4 <= 100, "TEST 3.2: C4 score is bounded in range [0, 100]");

  const hubOverview = await poiWeatherService.getHubWeatherOverview("Surabaya");
  assert(hubOverview && (hubOverview.city_name === "SURABAYA" || hubOverview.hub_city_name === "SURABAYA"), "TEST 3.3: Hub weather overview returns city_name='SURABAYA'");
  assert(hubOverview.status === "success", "TEST 3.4: Hub weather status is success");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM weathers WHERE zone_id = $1;", [testZoneId]);
    await ZoneModel.delete(testZoneId);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 06 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 06 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 06 TESTS FAILED.");
    process.exit(1);
  }
}

runPart06Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 06 test execution:", err);
  process.exit(1);
});
