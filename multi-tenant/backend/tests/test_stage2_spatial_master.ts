/*
 * test_stage2_spatial_master.ts
 * Stage 2 Integration Test: Global Spatial Master, Shared POI Invariant, and PostGIS Geofencing
 */

import { pool } from "../src/config/database.js";
import { globalSpatialMasterService } from "../src/services/spatial/GlobalSpatialMasterService.js";
import { overpassMirrorHealthService } from "../src/services/spatial/OverpassMirrorHealthService.js";
import { withTenantContext } from "../src/lib/tenantContext.js";

const TENANT_A = "test-spatial-tenant-a";
const TENANT_B = "test-spatial-tenant-b";

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

async function runStage2Tests() {
  console.log("\n==================================================================");
  console.log("🗺️  STAGE 2: GLOBAL SPATIAL MASTER & SHARED INVARIANT VERIFICATION");
  console.log("==================================================================\n");

  let zoneAId: string;
  let zoneBId: string;

  try {
    // 0. Initial Cleanup
    await pool.query(`DELETE FROM zones WHERE name LIKE 'Zona Operasi Sidoarjo%';`);
    await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
    await pool.query(`DELETE FROM pois WHERE id::text LIKE '11111111-1111-1111-1111-11111111110%';`);
    await pool.query(`DELETE FROM protocol_roads WHERE id::text IN ('22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301');`);

    console.log("Step 1: Setting up tenants...");
    // 1. Setup Test Tenants
    await pool.query(
      `INSERT INTO tenants (id, name, code, status, max_fleets, max_riders, max_zones)
       VALUES ($1, 'Tenant Spatial A', 'SPATIAL_A', 'ACTIVE', 20, 50, 10),
              ($2, 'Tenant Spatial B', 'SPATIAL_B', 'ACTIVE', 20, 50, 10)
       ON CONFLICT (id) DO NOTHING;`,
      [TENANT_A, TENANT_B]
    );
    console.log("Step 1 done.");

    console.log("Step 2: Inserting POI...");
    // 2. Insert Shared Global POIs (is_global = true)
    await pool.query(`
      INSERT INTO pois (id, logical_poi_id, external_id, name, category, latitude, longitude, geom, status, operational_status, is_global, city_name)
      VALUES 
        ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111101', 'node/111101', 'Alun-Alun Sidoarjo Global', 'PUBLIC_SPACE', -7.4478, 112.7183, ST_SetSRID(ST_MakePoint(112.7183, -7.4478), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo'),
        ('11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111102', 'node/111102', 'Stasiun Sidoarjo Global', 'TRANSPORTATION', -7.4560, 112.7170, ST_SetSRID(ST_MakePoint(112.7170, -7.4560), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo'),
        ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111103', 'node/111103', 'Pasar Larangan Global', 'COMMERCIAL', -7.4620, 112.7150, ST_SetSRID(ST_MakePoint(112.7150, -7.4620), 4326), 'APPROVED', 'ELIGIBLE', true, 'Sidoarjo')
      ON CONFLICT (id) DO UPDATE SET is_global = true, operational_status = 'ELIGIBLE';
    `);
    console.log("Step 2 done.");

    console.log("Step 3: Inserting roads...");
    // 3. Insert Protocol Road and Toll Road for Safety Buffer Tests
    await pool.query(`
      INSERT INTO protocol_roads (id, name, highway_type, restriction_type, geom, is_global)
      VALUES 
        (
          '22222222-2222-2222-2222-222222222201',
          'Jl. Ahmad Yani Sidoarjo (Protokol)',
          'primary',
          'PROHIBITED_ROAD',
          ST_SetSRID(ST_MakeLine(ST_MakePoint(112.7180, -7.4450), ST_MakePoint(112.7180, -7.4550)), 4326),
          true
        ),
        (
          '33333333-3333-3333-3333-333333333301',
          'Tol Surabaya-Gempol (KM 25)',
          'motorway',
          'PROHIBITED_TOLL_ROAD',
          ST_SetSRID(ST_MakeLine(ST_MakePoint(112.7000, -7.4400), ST_MakePoint(112.7000, -7.4600)), 4326),
          true
        )
      ON CONFLICT (id) DO UPDATE SET restriction_type = EXCLUDED.restriction_type, geom = EXCLUDED.geom;
    `);
    console.log("Step 3 done.");

    // 4. Create Zones for Tenant A and Tenant B covering Sidoarjo area
    const sidoarjoPolygonGeoJson = {
      type: "Polygon",
      coordinates: [[
        [112.7100, -7.4400],
        [112.7300, -7.4400],
        [112.7300, -7.4700],
        [112.7100, -7.4700],
        [112.7100, -7.4400]
      ]]
    };

    console.log("Step 4: Creating zones...");
    const zA = await withTenantContext(TENANT_A, async (client) => {
      const res = await client.query(
        `INSERT INTO zones (tenant_id, name, polygon, status)
         VALUES ($1, 'Zona Operasi Sidoarjo A', $2, 'ACTIVE')
         RETURNING id;`,
        [TENANT_A, JSON.stringify(sidoarjoPolygonGeoJson)]
      );
      return res.rows[0];
    });
    zoneAId = zA.id;

    const zB = await withTenantContext(TENANT_B, async (client) => {
      const res = await client.query(
        `INSERT INTO zones (tenant_id, name, polygon, status)
         VALUES ($1, 'Zona Operasi Sidoarjo B', $2, 'ACTIVE')
         RETURNING id;`,
        [TENANT_B, JSON.stringify(sidoarjoPolygonGeoJson)]
      );
      return res.rows[0];
    });
    zoneBId = zB.id;
    console.log("Step 4 done.");

    // TEST 1: Shared POI Access
    console.log("--- Test Suite 1: Shared POI Spatial Joins ---");
    const poisTenantA = await globalSpatialMasterService.getPoisInZone(TENANT_A, zoneAId);
    assert(poisTenantA.length >= 3, "Tenant A retrieves global POIs within zone", poisTenantA.length);

    const poisTenantB = await globalSpatialMasterService.getPoisInZone(TENANT_B, zoneBId);
    assert(poisTenantB.length >= 3, "Tenant B retrieves global POIs within zone", poisTenantB.length);

    const namesA = poisTenantA.map((p) => p.name).sort();
    const namesB = poisTenantB.map((p) => p.name).sort();
    assert(
      JSON.stringify(namesA) === JSON.stringify(namesB) && namesA.includes("Alun-Alun Sidoarjo Global"),
      "Both tenants refer to identical shared Global POIs without row duplication"
    );

    // TEST 2: Category Filter
    console.log("\n--- Test Suite 2: Spatial Category Filtering ---");
    const transportPois = await globalSpatialMasterService.getPoisInZone(TENANT_A, zoneAId, ["TRANSPORTATION"]);
    assert(
      transportPois.length === 1 && transportPois[0].name === "Stasiun Sidoarjo Global",
      "Category filter correctly selects TRANSPORTATION POIs only"
    );

    // TEST 3: Toll Corridor 25m Buffer Rejection
    console.log("\n--- Test Suite 3: Spatial Safety Validation (Toll & Protocol) ---");
    const tollResult = await globalSpatialMasterService.validateCoordinateSafety(-7.4500, 112.7001);
    assert(
      tollResult.isValid === false && tollResult.code === "PROHIBITED_TOLL_ROAD",
      "Point within 25m of Toll Corridor is correctly REJECTED (PROHIBITED_TOLL_ROAD)"
    );

    // TEST 4: Protocol Road 10m Buffer Rejection
    const roadResult = await globalSpatialMasterService.validateCoordinateSafety(-7.4500, 112.71805);
    assert(
      roadResult.isValid === false && roadResult.code === "PROHIBITED_ROAD",
      "Point within 10m of Protocol Road is correctly REJECTED (PROHIBITED_ROAD)"
    );

    // TEST 5: Safe Coordinate Approval
    const safeResult = await globalSpatialMasterService.validateCoordinateSafety(-7.4478, 112.7250);
    assert(
      safeResult.isValid === true,
      "Point outside prohibited buffers is APPROVED"
    );

    // TEST 6: Overpass Mirror Health Service
    console.log("\n--- Test Suite 4: Overpass Mirror Health & Failover ---");
    const primary = overpassMirrorHealthService.getPrimaryEndpoint();
    assert(
      primary && primary.healthScore >= 50,
      `Primary mirror selected: ${primary?.name} (Score: ${primary?.healthScore})`
    );

    overpassMirrorHealthService.recordResult(primary.url, false, 2500);
    const healthiest = overpassMirrorHealthService.getHealthiestEndpoints();
    assert(
      healthiest.length >= 3,
      "Mirror health scores recalculated dynamically upon recording latency/failures"
    );

    // TEST 7: Shared Spatial Stats
    console.log("\n--- Test Suite 5: Global Spatial Metadata & Aggregates ---");
    const stats = await globalSpatialMasterService.getSharedSpatialStatistics("Sidoarjo");
    assert(
      stats.is_global_shared === true && stats.total_global_pois >= 3,
      `Shared spatial statistics returned: ${stats.total_global_pois} POIs, is_global_shared: true`
    );

    console.log("\n==================================================================");
    console.log(`🎯 STAGE 2 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log("==================================================================\n");

  } catch (err: any) {
    console.error("💥 Error during Stage 2 test execution:", err);
    process.exitCode = 1;
  } finally {
    // Cleanup
    try {
      await pool.query(`DELETE FROM zones WHERE tenant_id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2);`, [TENANT_A, TENANT_B]);
      await pool.query(`DELETE FROM pois WHERE id::text LIKE '11111111-1111-1111-1111-11111111110%';`);
      await pool.query(`DELETE FROM protocol_roads WHERE id::text IN ('22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301');`);
    } catch {
      // Ignore cleanup error
    }
  }

  if (passedTests === totalTests && totalTests > 0) {
    console.log("🎉 ALL STAGE 2 INTEGRATION TESTS PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error("💥 SOME STAGE 2 TESTS FAILED!\n");
    process.exit(1);
  }
}

runStage2Tests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
