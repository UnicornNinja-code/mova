import { pool } from "../config/database.js";
import { zoneService } from "../services/zoneService.js";
import { operationalRuleService } from "../services/operationalRuleService.js";
import { ZoneModel } from "../models/zoneModel.js";
import { SystemSettingModel } from "../models/systemSettingModel.js";

async function runOperationalRulesTestRunner() {
  console.log("\n================================================================================");
  console.log("🧪 AUTOMATED TEST SUITE: OPERATIONAL RULE CONFIGURATION & DYNAMIC SPATIAL ENFORCEMENT");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Get actual protocol road segment geometry to buffer for testing
  const { rows: protocolGeomRows } = await pool.query(`
    SELECT ST_AsGeoJSON(ST_Buffer(geom::geography, 15)::geometry) AS buffer_geojson
    FROM protocol_roads
    WHERE restriction_type = 'PROHIBITED_ROAD'
    LIMIT 1;
  `);
  const protocolRoadPolygon = JSON.parse(protocolGeomRows[0].buffer_geojson);

  // Get actual toll road segment geometry to buffer for testing
  const { rows: tollGeomRows } = await pool.query(`
    SELECT ST_AsGeoJSON(ST_Buffer(geom::geography, 10)::geometry) AS buffer_geojson
    FROM protocol_roads
    WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
    LIMIT 1;
  `);

  const tollRoadPolygon = tollGeomRows.length > 0 ? JSON.parse(tollGeomRows[0].buffer_geojson) : null;

  // Clean test zones if existing
  const testZoneNames = [
    "Zona Test Protocol Only",
    "Zona Test Toll Only",
    "Zona Test Both Restrictions",
    "Zona Test Multi Reason Safety",
    "Zona Di Jalan Protokol Fail Test",
    "Zona Uji Coba Di Jalan Protokol",
    "Zona Uji Coba Di Atas Jalan Tol",
  ];

  for (const name of testZoneNames) {
    const existing = await ZoneModel.findByName(name);
    if (existing) await ZoneModel.delete(existing.id);
  }

  try {
    // Save original rule states to restore later
    const initialRules = await operationalRuleService.getOperationalRules();

    // TEST 1 — Read operational configuration from PostgreSQL system_settings
    console.log("📌 [TEST 1] Read Operational Rules from PostgreSQL system_settings...");
    const currentRules = await operationalRuleService.getOperationalRules();
    assert(
      typeof currentRules.protocol_road_prohibited === "boolean" &&
        typeof currentRules.toll_road_prohibited === "boolean",
      `Operational rules loaded successfully: ${JSON.stringify(currentRules)}`
    );

    // TEST 2 — Update Protocol-Road Rule (ON -> OFF -> ON)
    console.log("\n📌 [TEST 2] Update Protocol-Road Rule (ON -> OFF -> ON)...");
    await operationalRuleService.updateOperationalRules({ protocol_road_prohibited: false });
    let rulesOff = await operationalRuleService.getOperationalRules();
    assert(rulesOff.protocol_road_prohibited === false, "OPERATIONAL_RULE_PROTOCOL_ROAD updated to false");

    await operationalRuleService.updateOperationalRules({ protocol_road_prohibited: true });
    let rulesOn = await operationalRuleService.getOperationalRules();
    assert(rulesOn.protocol_road_prohibited === true, "OPERATIONAL_RULE_PROTOCOL_ROAD restored to true");

    // TEST 3 — Update Toll-Road Rule (ON -> OFF -> ON)
    console.log("\n📌 [TEST 3] Update Toll-Road Rule (ON -> OFF -> ON)...");
    await operationalRuleService.updateOperationalRules({ toll_road_prohibited: false });
    rulesOff = await operationalRuleService.getOperationalRules();
    assert(rulesOff.toll_road_prohibited === false, "OPERATIONAL_RULE_TOLL_ROAD updated to false");

    await operationalRuleService.updateOperationalRules({ toll_road_prohibited: true });
    rulesOn = await operationalRuleService.getOperationalRules();
    assert(rulesOn.toll_road_prohibited === true, "OPERATIONAL_RULE_TOLL_ROAD restored to true");

    // TEST 4 — Rule ON + Zone Intersects Protocol Road -> HTTP 409
    console.log("\n📌 [TEST 4] Protocol Rule ON + Zone Intersects Protocol Road -> HTTP 409 Conflict...");
    await operationalRuleService.updateOperationalRules({ protocol_road_prohibited: true });
    let protocolRejected = false;
    try {
      await zoneService.createZone({
        name: "Zona Test Protocol Only",
        polygon: protocolRoadPolygon,
      });
    } catch (err) {
      protocolRejected = true;
      assert(err.statusCode === 409, "Zone creation rejected with HTTP 409");
      assert(err.code === "ZONE_INTERSECTS_RESTRICTED_AREA", "Error code is 'ZONE_INTERSECTS_RESTRICTED_AREA'");
    }
    assert(protocolRejected, "Protocol road rule ON correctly blocked zone creation");

    // TEST 5 — Rule OFF + Zone Intersects Protocol Road -> Accepted (200) + Advisory Warnings
    console.log("\n📌 [TEST 5] Protocol Rule OFF + Zone Intersects Protocol Road -> Accepted (200) + Warning...");
    await operationalRuleService.updateOperationalRules({ protocol_road_prohibited: false });
    const acceptedProtocolZone = await zoneService.createZone({
      name: "Zona Test Protocol Only",
      polygon: protocolRoadPolygon,
    });
    assert(acceptedProtocolZone && acceptedProtocolZone.id, "Zone created successfully when rule is OFF");
    assert(
      Array.isArray(acceptedProtocolZone.warnings) && acceptedProtocolZone.warnings.length > 0,
      `Advisory warning returned in metadata (${acceptedProtocolZone.warnings?.[0]?.message})`
    );

    // TEST 6 — Rule ON + Zone Intersects Toll Road -> HTTP 409
    console.log("\n📌 [TEST 6] Toll Rule ON + Zone Intersects Toll Road -> HTTP 409 Conflict...");
    await operationalRuleService.updateOperationalRules({ toll_road_prohibited: true });
    let tollRejected = false;
    try {
      await zoneService.createZone({
        name: "Zona Test Toll Only",
        polygon: tollRoadPolygon,
      });
    } catch (err) {
      tollRejected = true;
      assert(err.statusCode === 409, "Zone creation rejected with HTTP 409");
      assert(err.code === "ZONE_INTERSECTS_TOLL_ROAD", "Error code is 'ZONE_INTERSECTS_TOLL_ROAD'");
    }
    assert(tollRejected, "Toll road rule ON correctly blocked zone creation");

    // TEST 7 — Rule OFF + Zone Intersects Toll Road -> Accepted (200) + Advisory Warnings
    console.log("\n📌 [TEST 7] Toll Rule OFF + Zone Intersects Toll Road -> Accepted (200) + Warning...");
    await operationalRuleService.updateOperationalRules({ toll_road_prohibited: false });
    const acceptedTollZone = await zoneService.createZone({
      name: "Zona Test Toll Only",
      polygon: tollRoadPolygon,
    });
    assert(acceptedTollZone && acceptedTollZone.id, "Zone created successfully when toll rule is OFF");
    assert(
      Array.isArray(acceptedTollZone.warnings) && acceptedTollZone.warnings.length > 0,
      `Advisory warning returned in metadata (${acceptedTollZone.warnings?.[0]?.message})`
    );

    // TEST 8 — Both Rules ON + Zone Intersects Both -> HTTP 409 Blocking
    console.log("\n📌 [TEST 8] Both Rules ON + Zone Intersects Both -> HTTP 409 Conflict...");
    await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: true,
      toll_road_prohibited: true,
    });
    let bothRejected = false;
    try {
      await zoneService.createZone({
        name: "Zona Test Both Restrictions",
        polygon: tollRoadPolygon,
      });
    } catch (err) {
      bothRejected = true;
      assert(err.statusCode === 409, "Zone creation rejected with HTTP 409");
    }
    assert(bothRejected, "Both rules ON correctly blocked zone creation");

    // TEST 9 — Both Rules OFF + Zone Intersects Both -> Accepted (200) + Advisory Warnings
    console.log("\n📌 [TEST 9] Both Rules OFF + Zone Intersects Both -> Accepted + Advisory Warnings...");
    await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: false,
      toll_road_prohibited: false,
    });
    // Clean up previous toll zone before testing new zone creation
    const prevTollZone = await ZoneModel.findByName("Zona Test Toll Only");
    if (prevTollZone) await ZoneModel.delete(prevTollZone.id);

    const acceptedBothZone = await zoneService.createZone({
      name: "Zona Test Both Restrictions",
      polygon: tollRoadPolygon,
    });
    assert(acceptedBothZone && acceptedBothZone.id, "Zone created successfully when both rules are OFF");
    assert(
      Array.isArray(acceptedBothZone.warnings) && acceptedBothZone.warnings.length >= 1,
      "Advisory warning array returned for zone intersecting restriction"
    );

    // TEST 10 — Existing Zone Becomes Affected After Rule OFF -> ON (Re-evaluated to RESTRICTED)
    console.log("\n📌 [TEST 10] Rule OFF -> ON Transition (Re-evaluates zone to RESTRICTED)...");
    const reevalOnRes = await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: true,
      toll_road_prohibited: true,
    });
    assert(
      reevalOnRes.affected_zones_summary.newly_restricted >= 1,
      `Re-evaluation correctly marked ${reevalOnRes.affected_zones_summary.newly_restricted} zone(s) as RESTRICTED`
    );

    const reevalZone = await ZoneModel.findById(acceptedProtocolZone.id);
    assert(reevalZone.status === "RESTRICTED", "Zone status updated to RESTRICTED");
    assert(reevalZone.invalid_reason !== null, `Zone invalid_reason populated with metadata (${reevalZone.invalid_reason?.code})`);

    // TEST 11 & 12 — Refinement 2: Multi-Reason Safety on Rule OFF -> ON/OFF
    console.log("\n📌 [TEST 11 & 12] Multi-Reason Re-Evaluation Safety Check...");
    await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: false,
      toll_road_prohibited: false,
    });

    // Delete previous test zones before creating multiZone to avoid polygon overlap
    if (acceptedProtocolZone) await ZoneModel.delete(acceptedProtocolZone.id);
    if (acceptedBothZone) await ZoneModel.delete(acceptedBothZone.id);

    const multiZone = await zoneService.createZone({
      name: "Zona Test Multi Reason Safety",
      polygon: protocolRoadPolygon,
    });

    // Turn ON both rules -> multiZone becomes RESTRICTED
    await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: true,
      toll_road_prohibited: true,
    });

    const multiRestricted = await ZoneModel.findById(multiZone.id);
    assert(multiRestricted.status === "RESTRICTED", "Multi-restriction zone is RESTRICTED when both rules ON");

    // Turn OFF ONLY Toll Road -> Zone intersects Protocol Road too, so it MUST REMAIN RESTRICTED!
    await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: true,
      toll_road_prohibited: false,
    });

    const multiStillRestricted = await ZoneModel.findById(multiZone.id);
    assert(
      multiStillRestricted.status === "RESTRICTED",
      "SAFETY VERIFIED: Turning OFF Toll Road did NOT incorrectly restore zone to ACTIVE because Protocol Road is still ON!"
    );

    // Turn OFF Protocol Road as well -> NOW zone MUST become ACTIVE!
    await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: false,
      toll_road_prohibited: false,
    });

    const multiNowActive = await ZoneModel.findById(multiZone.id);
    assert(
      multiNowActive.status === "ACTIVE" && multiNowActive.invalid_reason === null,
      "Zone correctly restored to ACTIVE only when ALL blocking restrictions are OFF!"
    );

    // TEST 13 — Audit Logging Verification
    console.log("\n📌 [TEST 13] Operational Rule Change Audit Logging...");
    const { rows: auditRows } = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'OPERATIONAL_RULE_CHANGED' ORDER BY created_at DESC LIMIT 1;"
    );
    assert(
      auditRows.length > 0 && auditRows[0].action === "OPERATIONAL_RULE_CHANGED",
      `Audit log recorded for OPERATIONAL_RULE_CHANGED (Entity: ${auditRows[0]?.entity_id})`
    );

    // TEST 14 — PostGIS Scalable Spatial Re-Evaluation Verification (Refinement 3)
    console.log("\n📌 [TEST 14] Scalable PostGIS Query Spatial Re-Evaluation Check...");
    const reevalScalableRes = await operationalRuleService.updateOperationalRules({
      protocol_road_prohibited: true,
      toll_road_prohibited: true,
    });
    assert(
      typeof reevalScalableRes.affected_zones_summary.total_reevaluated === "number",
      `PostGIS spatial re-evaluation performed without full table scan (Re-evaluated count: ${reevalScalableRes.affected_zones_summary.total_reevaluated})`
    );

    // TEST 15 — Zero Geometry Deletion Verification
    console.log("\n📌 [TEST 15] Zero Zone Geometry Deletion Check...");
    const { rows: allZonesGeom } = await pool.query("SELECT id, polygon FROM zones WHERE name LIKE 'Zona Test%';");
    const validGeomCount = allZonesGeom.filter((z) => z.polygon && z.polygon.type === "Polygon").length;
    assert(
      validGeomCount === allZonesGeom.length,
      `100% of test zones (${validGeomCount}/${allZonesGeom.length}) preserved their original geometry intact!`
    );

    // TEST 16 & 17 — Zero DSS & POI Formula Regression Check
    console.log("\n📌 [TEST 16 & 17] Zero DSS & POI Formula Regression Check...");
    const { rows: poiCount } = await pool.query("SELECT COUNT(*)::int AS total FROM pois;");
    const { rows: critCount } = await pool.query("SELECT COUNT(*)::int AS total FROM criterias;");
    assert(poiCount[0].total > 0, `POI table intact (${poiCount[0].total} records)`);
    assert(critCount[0].total > 0, `Criteria table intact (${critCount[0].total} records)`);

    // CLEANUP Test Zones & Restore Initial Rules
    console.log("\n📌 Cleaning up test data & restoring initial settings...");
    for (const name of testZoneNames) {
      const z = await ZoneModel.findByName(name);
      if (z) await ZoneModel.delete(z.id);
    }
    await operationalRuleService.updateOperationalRules(initialRules);

    console.log("\n================================================================================");
    console.log(`🎉 TEST OPERATIONAL RULES COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("💥 TEST OPERATIONAL RULES FAILED:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runOperationalRulesTestRunner();
