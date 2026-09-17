/*
 * test_stage3a_competitor_engine.ts
 * Comprehensive Stage 3A Verification: C6 Relevant Competitor Engine, RLS Isolation, & Regression Tests
 */

import { pool } from "../src/config/database.js";
import { withTenantContext } from "../src/lib/tenantContext.js";
import {
  calculatePriceOverlap,
  resolveCategoryPricePrior,
  CATEGORY_PRICE_PRIORS_V1,
} from "../src/services/competitor/PriceOverlapEngine.js";
import { calculateCompetitorRelevance } from "../src/services/competitor/CompetitorRelevanceEngine.js";
import {
  calculateSpatialDecay,
  calculateTemporalFactor,
  calculateCompetitivePressure,
} from "../src/services/competitor/SpatialTemporalPressureEngine.js";
import { competitorProfileService } from "../src/services/competitor/CompetitorProfileService.js";
import { competitorObservationService } from "../src/services/competitor/CompetitorObservationService.js";
import { competitorRelevanceService } from "../src/services/competitor/CompetitorRelevanceService.js";
import { globalSpatialMasterService } from "../src/services/spatial/GlobalSpatialMasterService.js";

const TENANT_A = "test-c6-tenant-a";
const TENANT_B = "test-c6-tenant-b";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail || "");
    process.exitCode = 1;
  }
}

async function runStage3aTests() {
  console.log("\n==================================================================");
  console.log("☕ STAGE 3A: C6 RELEVANT COMPETITOR DOMAIN & ENGINE VERIFICATION");
  console.log("==================================================================\n");

  let profileAId: string;
  let profileBId: string;

  try {
    // 0. Cleanup Previous Test Artifacts
    await pool.query(`DELETE FROM competitor_observations WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM competitor_profiles WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM pois WHERE id::text LIKE '33333333-3333-3333-3333-33333333330%';`);

    // 1. Setup Test Tenants
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Tenant C6 Coffee A', 'C6_A', 'ACTIVE', 20, 50, 10),
              ($2, 'Tenant C6 Coffee B', 'C6_B', 'ACTIVE', 20, 50, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A, TENANT_B]
    );

    // =========================================================================
    // SUITE 1: Pure Mathematical Price Overlap Engine
    // =========================================================================
    console.log("--- Suite 1: Pure Mathematical Price Overlap Engine ---");
    // Case 1.1: 100% Identical Range
    const p1 = calculatePriceOverlap(10000, 15000, 10000, 15000);
    assert(p1 === 1.0, "100% identical price range returns 1.0", p1);

    // Case 1.2: Partial Overlap ([10k-15k] vs [12k-18k] -> overlap [12k-15k] = 3k/5k = 0.6)
    const p2 = calculatePriceOverlap(10000, 15000, 12000, 18000);
    assert(p2 === 0.6, "Partial overlap [10k-15k] vs [12k-18k] returns 0.60", p2);

    // Case 1.3: Zero Overlap ([10k-15k] vs [25k-70k] -> 0.0)
    const p3 = calculatePriceOverlap(10000, 15000, 25000, 70000);
    assert(p3 === 0.0, "Zero overlap [10k-15k] vs [25k-70k] returns 0.0", p3);

    // Case 1.4: Single-Price Tenant ([12k, 12k] inside [10k, 15k] -> 1.0)
    const p4 = calculatePriceOverlap(12000, 12000, 10000, 15000);
    assert(p4 === 1.0, "Single-price tenant inside competitor range returns 1.0", p4);

    // Case 1.5: Single-Price Tenant ([8k, 8k] outside [10k, 15k] -> 0.0)
    const p5 = calculatePriceOverlap(8000, 8000, 10000, 15000);
    assert(p5 === 0.0, "Single-price tenant outside competitor range returns 0.0", p5);

    // Case 1.6: Category Price Prior V1 Resolution
    const priorWarkop = resolveCategoryPricePrior("WARUNG_KOPI");
    assert(
      priorWarkop !== null && priorWarkop.min === 5000 && priorWarkop.max === 15000,
      "Category Price Prior V1 resolves WARUNG_KOPI to Rp5.000 - Rp15.000"
    );

    // =========================================================================
    // SUITE 2: Pure Competitor Relevance Engine
    // =========================================================================
    console.log("\n--- Suite 2: Competitor Relevance Engine & Threshold ---");
    // Case 2.1: Perfect Match (Price 1.0, Cat true, Model true) -> R_i = 1.0
    const r1 = calculateCompetitorRelevance({ priceScore: 1.0, categoryMatch: true, modelMatch: true });
    assert(r1.relevanceScore === 1.0 && r1.isRelevant === true, "Perfect match gives R_i = 1.0 and isRelevant = true");

    // Case 2.2: High-End Cafe (Price 0.0, Cat true, Model false) -> R_i = 0.30 < 0.40 -> EXCLUDED
    const r2 = calculateCompetitorRelevance({ priceScore: 0.0, categoryMatch: true, modelMatch: false });
    assert(
      r2.relevanceScore === 0.30 && r2.isRelevant === false,
      "High-end cafe (Price 0.0, Cat true, Model false) gives R_i = 0.30 and is EXCLUDED (R_i < 0.40)"
    );

    // Case 2.3: Mobile Budget Competitor (Price 1.0, Cat true, Model true) -> R_i = 1.0 >= 0.40 -> INCLUDED
    const r3 = calculateCompetitorRelevance({ priceScore: 1.0, categoryMatch: true, modelMatch: true });
    assert(r3.isRelevant === true, "Mobile budget competitor is INCLUDED");

    // =========================================================================
    // SUITE 3: Spatial Decay, Overnight Temporal Windows, and Pressure
    // =========================================================================
    console.log("\n--- Suite 3: Spatial Decay & Overnight Temporal Windows ---");
    // Case 3.1: Spatial Decay at distance 0, 250m, 500m, 600m with radius 500m
    const s0 = calculateSpatialDecay(0, 500);
    const s250 = calculateSpatialDecay(250, 500);
    const s500 = calculateSpatialDecay(500, 500);
    const s600 = calculateSpatialDecay(600, 500);
    assert(s0 === 1.0, "Spatial decay at distance 0m is 1.0");
    assert(s250 === 0.5, "Spatial decay at distance 250m / 500m is 0.50");
    assert(s500 === 0.0, "Spatial decay at distance 500m / 500m is 0.0");
    assert(s600 === 0.0, "Spatial decay at distance > radius is 0.0");

    // Case 3.2: Daytime window (08:00 - 20:00)
    const tDayActive = calculateTemporalFactor("08:00:00", "20:00:00", "14:00:00");
    const tDayInactive = calculateTemporalFactor("08:00:00", "20:00:00", "23:00:00");
    assert(tDayActive === 1.0, "Daytime window active time returns 1.0");
    assert(tDayInactive === 0.2, "Daytime window inactive time returns 0.2");

    // Case 3.3: Overnight window (20:00 - 04:00)
    const tNight1 = calculateTemporalFactor("20:00:00", "04:00:00", "23:30:00");
    const tNight2 = calculateTemporalFactor("20:00:00", "04:00:00", "02:15:00");
    const tNightInactive = calculateTemporalFactor("20:00:00", "04:00:00", "10:00:00");
    assert(tNight1 === 1.0, "Overnight window at 23:30 returns 1.0");
    assert(tNight2 === 1.0, "Overnight window at 02:15 returns 1.0");
    assert(tNightInactive === 0.2, "Overnight window at 10:00 returns 0.2");

    // Case 3.4: Competitive Pressure (P_i)
    const pIndividual = calculateCompetitivePressure(1.0, 0.8, 1.0, 0.6);
    assert(pIndividual === 0.48, "Competitive pressure P_i = 1.0 * 0.8 * 1.0 * 0.6 = 0.48", pIndividual);

    // =========================================================================
    // SUITE 4: Competitor Profile & Dynamic Observation Domain Services
    // =========================================================================
    console.log("\n--- Suite 4: Competitor Profile & Observation Domain Services ---");
    // 4.1 Create Profile for Tenant A
    const profA = await competitorProfileService.createProfile(TENANT_A, {
      name: "Profil Kopi Keliling Sidoarjo A",
      min_price: 10000,
      max_price: 15000,
      radius_meters: 500,
      target_categories: ["WARUNG_KOPI", "GIRAS", "KOPI_KELILING", "BOOTH"],
      business_models: ["MOBILE", "SEMI_MOBILE", "BOOTH"],
      activity_start: "06:00:00",
      activity_end: "22:00:00",
    });
    profileAId = profA.id!;
    assert(profA && profA.min_price === 10000, "Tenant A competitor profile created successfully");

    // 4.2 Create Profile for Tenant B
    const profB = await competitorProfileService.createProfile(TENANT_B, {
      name: "Profil Kopi Bakery B",
      min_price: 20000,
      max_price: 40000,
      radius_meters: 750,
      target_categories: ["CAFE", "BAKERY"],
      business_models: ["BOOTH", "CAFE"],
    });
    profileBId = profB.id!;
    assert(profB && profB.min_price === 20000, "Tenant B competitor profile created successfully");

    // 4.3 Report Field Observation for Tenant A
    const obsA = await competitorObservationService.reportObservation(TENANT_A, null, {
      profile_id: profileAId,
      name: "Kopi Keliling Cak Mat (Rider Observation)",
      category: "KOPI_KELILING",
      latitude: -7.4480,
      longitude: 112.7185,
      min_price: 10000,
      max_price: 14000,
      business_model: "MOBILE",
      source: "RIDER",
    });
    assert(obsA && obsA.status === "PENDING" && obsA.confidence === 0.6, "Rider observation reported as PENDING (Conf 0.6)");

    // 4.4 Verify Observation by Supervisor
    const verifiedObs = await competitorObservationService.verifyObservation(TENANT_A, obsA.id!);
    assert(
      verifiedObs.status === "VERIFIED" && verifiedObs.confidence === 1.0,
      "Supervisor verifies observation -> status VERIFIED, confidence 1.0"
    );

    // =========================================================================
    // SUITE 5: Security & Anti-IDOR / Cross-Tenant Triggers
    // =========================================================================
    console.log("\n--- Suite 5: Security & Anti-IDOR Cross-Tenant Guards ---");
    // 5.1 Cross-Tenant Profile Assignment Violation Guard
    let crossTenantBlocked = false;
    try {
      await withTenantContext(TENANT_A, async (client) => {
        // Attempt to create observation for Tenant A pointing to Tenant B's profile
        await client.query(
          `INSERT INTO competitor_observations (
            tenant_id, profile_id, name, category, latitude, longitude
          ) VALUES ($1, $2, 'Malicious Cross Observation', 'KOPI_KELILING', -7.45, 112.72);`,
          [TENANT_A, profileBId]
        );
      });
    } catch (err: any) {
      if (err.message.includes("CROSS_TENANT_VIOLATION")) {
        crossTenantBlocked = true;
      }
    }
    assert(crossTenantBlocked, "Database trigger BLOCKS cross-tenant profile_id assignment (CROSS_TENANT_VIOLATION)");

    // 5.2 RLS Isolation: Tenant B cannot see Tenant A's competitor profiles
    const tenantBProfiles = await withTenantContext(TENANT_B, async (client) => {
      const { rows } = await client.query(`SELECT id, name, tenant_id FROM competitor_profiles;`);
      return rows;
    });
    const hasTenantAProfile = tenantBProfiles.some((p) => p.tenant_id === TENANT_A);
    assert(!hasTenantAProfile, "Tenant B context CANNOT see Tenant A competitor profiles due to RLS");

    // 5.3 RLS Isolation: Tenant B cannot see Tenant A's competitor observations
    const tenantBObservations = await withTenantContext(TENANT_B, async (client) => {
      const { rows } = await client.query(`SELECT id, name, tenant_id FROM competitor_observations;`);
      return rows;
    });
    const hasTenantAObs = tenantBObservations.some((o) => o.tenant_id === TENANT_A);
    assert(!hasTenantAObs, "Tenant B context CANNOT see Tenant A observations due to RLS");

    // =========================================================================
    // SUITE 6: End-to-End C6 Evaluation Aggregation
    // =========================================================================
    console.log("\n--- Suite 6: End-to-End C6 Evaluation Aggregation ---");
    // Insert Global OSM POIs near candidate coordinate (-7.4478, 112.7183)
    await pool.query(`
      INSERT INTO pois (id, logical_poi_id, external_id, name, category, latitude, longitude, geom, status, operational_status, is_global, city_name)
      VALUES 
        -- 1. Direct Competitor: Warkop Giras (~50m away) -> High Relevance
        ('33333333-3333-3333-3333-333333333301', '33333333-3333-3333-3333-333333333301', 'node/3331', 'Warkop Giras 99 Global', 'WARUNG_KOPI', -7.4480, 112.7184, ST_SetSRID(ST_MakePoint(112.7184, -7.4480), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo'),
        -- 2. Irrelevant Competitor: High-End Specialty Cafe (~100m away) -> Excluded (R_i < 0.40)
        ('33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333302', 'node/3332', 'Starbucks Premium Specialty', 'CAFE', -7.4485, 112.7185, ST_SetSRID(ST_MakePoint(112.7185, -7.4485), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo')
      ON CONFLICT (id) DO NOTHING;
    `);

    const c6Result = await competitorRelevanceService.evaluateC6ForCoordinate(
      TENANT_A,
      -7.4478,
      112.7183,
      "14:00:00"
    );

    assert(c6Result.criterion === "C6" && c6Result.type === "COST", "C6 result returned with type COST");
    assert(c6Result.total_candidates_analyzed >= 3, "Analyzed candidates include both OSM POIs and field observations");

    // Verify that Starbucks is filtered out from relevant competitors
    const starbucksContr = c6Result.contributors.find((c) => c.name.includes("Starbucks"));
    assert(
      starbucksContr !== undefined && starbucksContr.is_relevant === false,
      "Starbucks / High-End Cafe is correctly filtered out (is_relevant = false)"
    );

    // Verify that Warkop and Verified Rider Observation are included
    const warkopContr = c6Result.contributors.find((c) => c.name.includes("Warkop Giras"));
    assert(
      warkopContr !== undefined && warkopContr.is_relevant === true && warkopContr.competitive_pressure > 0,
      "Warkop Giras contributes positively to competitive pressure C6"
    );

    assert(c6Result.value > 0, `Total C6 Score calculated: ${c6Result.value} (COST criterion)`);

    // =========================================================================
    // SUITE 7: Regression Checks (Stage 1 & Stage 2 Invariance)
    // =========================================================================
    console.log("\n--- Suite 7: Stage 1 & Stage 2 Regression Invariance ---");
    // Verify Stage 2 Global Spatial Master shared stats
    const spatialStats = await globalSpatialMasterService.getSharedSpatialStatistics("Sidoarjo");
    assert(spatialStats.is_global_shared === true, "Stage 2 Global Spatial Master stats remain intact");

    console.log("\n==================================================================");
    console.log(`🎯 STAGE 3A TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("==================================================================\n");

  } catch (err: any) {
    console.error("💥 Error during Stage 3A test execution:", err);
    process.exitCode = 1;
  } finally {
    try {
      await pool.query(`DELETE FROM competitor_observations WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM competitor_profiles WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM pois WHERE id::text LIKE '33333333-3333-3333-3333-33333333330%';`);
    } catch {
      // Ignore cleanup error
    }
  }

  if (passedTests === totalTests && totalTests > 0) {
    console.log("🎉 ALL STAGE 3A INTEGRATION TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME STAGE 3A TESTS FAILED!\n");
    process.exit(1);
  }
}

runStage3aTests().catch((err) => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});
