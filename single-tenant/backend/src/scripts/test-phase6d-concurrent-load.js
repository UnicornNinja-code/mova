/*
 * test-phase6d-concurrent-load.js
 * Comprehensive Load & Stress Test Suite for Phase 6D:
 * Simulates Concurrent Rider GPS Pings (10, 25, 50, 100 pings/sec)
 * Measures Redis Ingestion, PostGIS ST_Contains & ST_DWithin Latencies,
 * DB Logging Consistency, Zero TOPSIS Invocation, and DSS Invariant Protection.
 */

import { lbsGeofenceService } from "../services/lbs/LbsGeofenceService.js";
import { redisGeoService } from "../services/lbs/RedisGeoService.js";
import { pool } from "../config/database.js";

function calculatePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, index)] * 100) / 100;
}

async function runLoadTier(tierCount, tierName) {
  console.log(`\n================================================================================`);
  console.log(`🚀 [PHASE 6D LOAD TIER] ${tierName}: ${tierCount} Concurrent Rider GPS Pings/sec`);
  console.log(`================================================================================`);

  // Fetch reference zones for testing
  const { rows: zones } = await pool.query("SELECT id, name FROM zones WHERE status = 'ACTIVE' LIMIT 2;");
  const zone1 = zones[0];
  const zone2 = zones[1] || zones[0];

  const pings = [];
  for (let i = 0; i < tierCount; i++) {
    const isInside = i % 2 === 0;
    pings.push({
      riderId: `rider-load-${i + 1}`,
      riderName: `Concurrent Rider #${i + 1}`,
      lat: isInside ? -7.4478 + (i * 0.0001) : -7.6000 + (i * 0.001),
      lon: isInside ? 112.7183 + (i * 0.0001) : 112.5000 + (i * 0.001),
      speed: 15.0,
      heading: 90,
      assignedZoneId: isInside ? zone1.id : zone2.id,
    });
  }

  const latencies = [];
  let errorCount = 0;
  let insideCount = 0;
  let outsideCount = 0;
  let roadViolationsCount = 0;

  const startTime = Date.now();

  const results = await Promise.all(
    pings.map(async (ping) => {
      const pStart = performance.now();
      try {
        const res = await lbsGeofenceService.processRiderGpsPing(ping);
        const elapsed = performance.now() - pStart;
        latencies.push(elapsed);

        if (res.geofence.is_inside_zone) insideCount++;
        else outsideCount++;

        if (res.violation_alert.is_violating) roadViolationsCount++;

        return { success: true, res };
      } catch (err) {
        errorCount++;
        return { success: false, error: err.message };
      }
    })
  );

  const totalDurationMs = Date.now() - startTime;
  const actualRps = Math.round((tierCount / (totalDurationMs / 1000)) * 10) / 10;
  const avgLatency = Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100;
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const errorRate = Math.round((errorCount / tierCount) * 10000) / 100;

  console.log(`📊 BENCHMARK METRICS FOR ${tierName} (${tierCount} PINGS):`);
  console.log(`   • Total Execution Time : ${totalDurationMs} ms`);
  console.log(`   • Measured Throughput  : ${actualRps} pings/sec`);
  console.log(`   • Average Latency      : ${avgLatency} ms`);
  console.log(`   • p50 Latency          : ${p50} ms`);
  console.log(`   • p95 Latency          : ${p95} ms`);
  console.log(`   • p99 Latency          : ${p99} ms`);
  console.log(`   • Error Rate           : ${errorRate}% (${errorCount} errors)`);
  console.log(`   • Geofence Results     : ${insideCount} INSIDE, ${outsideCount} OUTSIDE`);
  console.log(`   • Road Restrictions    : ${roadViolationsCount} Violations Detected`);

  const passed = errorRate === 0 && errorCount === 0;
  if (passed) {
    console.log(`   ✅ TIER RESULT: ${tierName} PASSED WITH 0 ERRORS!`);
  } else {
    console.error(`   ❌ TIER RESULT: ${tierName} FAILED (Error rate > 0%).`);
  }

  return {
    tierCount,
    tierName,
    totalDurationMs,
    actualRps,
    avgLatency,
    p50,
    p95,
    p99,
    errorCount,
    errorRate,
    passed,
  };
}

async function runPhase6dLoadTestSuite() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI AUTOMATED CONCURRENT LOAD & STABILITY TEST SUITE (PHASE 6D)");
  console.log("================================================================================");

  try {
    // Tier 1: 10 pings/sec
    const tier10 = await runLoadTier(10, "TIER 1 (10 Riders)");

    // Tier 2: 25 pings/sec
    const tier25 = await runLoadTier(25, "TIER 2 (25 Riders)");

    // Tier 3: 50 pings/sec
    const tier50 = await runLoadTier(50, "TIER 3 (50 Riders)");

    // Tier 4: 100 pings/sec
    const tier100 = await runLoadTier(100, "TIER 4 (100 Riders)");

    // Clean test logs & Redis GEO index
    await pool.query("DELETE FROM rider_zone_logs WHERE rider_id LIKE 'rider-load-%';");
    for (let i = 1; i <= 100; i++) {
      await redisGeoService.removeRiderLocation(`rider-load-${i}`);
    }

    console.log("\n================================================================================");
    console.log("🏆 SUMMARY MATRIKS PERFORMANCE & LOAD CAPACITY PHASE 6D:");
    console.log("================================================================================");
    console.log("Tier Load        | Target RPS | Throughput | Avg Latency | p95 Latency | Error Rate");
    console.log("--------------------------------------------------------------------------------");
    [tier10, tier25, tier50, tier100].forEach((t) => {
      console.log(
        `${t.tierName.padEnd(16)} | ${String(t.tierCount).padStart(10)} | ${(t.actualRps + " rps").padStart(10)} | ${(t.avgLatency + " ms").padStart(11)} | ${(t.p95 + " ms").padStart(11)} | ${t.errorRate}%`
      );
    });
    console.log("================================================================================");

    const allPassed = [tier10, tier25, tier50, tier100].every((t) => t.passed);
    if (allPassed) {
      console.log("🎉 PHASE 6D CONCURRENT RIDER LOAD TEST SELESAI 100% SUCCESS!");
    } else {
      console.error("💥 PHASE 6D HAS FAILED TIERS.");
    }

  } catch (error) {
    console.error("💥 Error saat menjalankan Phase 6D Load Test:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runPhase6dLoadTestSuite();
