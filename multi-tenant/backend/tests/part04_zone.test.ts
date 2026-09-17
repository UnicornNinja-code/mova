/*
 * part04_zone.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 04:
 * Zone Management, GeoJSON PostGIS Spatial Indexing, Coverage Radius Constraints & Capacity Validation.
 */

import { pool } from "../src/config/database.js";
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

async function runPart04Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 04: ZONE & SPATIAL OPERATIONAL CONTEXT TESTS");
  console.log("========================================================\n");

  const testSuffix = Date.now();
  const validZoneName = `Zona Gubeng Test ${testSuffix}`;
  let createdZoneId: string | number = "";

  // Valid Polygon inside Surabaya (around Gubeng / Central Surabaya)
  const validSurabayaPolygon = {
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
  };

  // Invalid Polygon far outside operational radius (e.g. Jakarta coordinates)
  const farAwayPolygon = {
    type: "Polygon",
    coordinates: [
      [
        [106.8200, -6.1750],
        [106.8300, -6.1750],
        [106.8300, -6.1850],
        [106.8200, -6.1850],
        [106.8200, -6.1750],
      ],
    ],
  };

  // Malformed Polygon (unclosed / fewer than 4 coordinate points in ring)
  const malformedPolygon = {
    type: "Polygon",
    coordinates: [
      [
        [112.7480, -7.2650],
        [112.7550, -7.2650],
      ],
    ],
  };

  // -------------------------------------------------------------
  // GROUP 1: Hub Configuration & Operational Bounds (ZONE-006)
  // -------------------------------------------------------------
  console.log("📍 [GROUP 1] Hub Spatial Configuration & Bounds (ZONE-006)");

  const zoneConfig = await zoneService.getZoneConfig();
  assert(zoneConfig && zoneConfig.hub_city_name === "Surabaya", "TEST 1.1: Hub city name is 'Surabaya'");
  assert(zoneConfig.hub_latitude < -7.0 && zoneConfig.hub_latitude > -7.5, "TEST 1.2: Hub latitude is in Surabaya region");
  assert(zoneConfig.hub_longitude > 112.5 && zoneConfig.hub_longitude < 113.0, "TEST 1.3: Hub longitude is in Surabaya region");
  assert(
    zoneConfig.operational_bounds &&
      zoneConfig.operational_bounds.min_lat < zoneConfig.hub_latitude &&
      zoneConfig.operational_bounds.max_lat > zoneConfig.hub_latitude,
    "TEST 1.4: Operational bounding box wraps central hub correctly"
  );

  // -------------------------------------------------------------
  // GROUP 2: Pre-Validation of Zone Polygons (ZONE-002, ZONE-005)
  // -------------------------------------------------------------
  console.log("\n📐 [GROUP 2] Zone Geometry Pre-Validation (ZONE-002, ZONE-005)");

  // TEST 2.1: Valid polygon inside coverage
  const validPreVal = await zoneService.preValidateZonePolygon({
    polygon: validSurabayaPolygon,
    name: validZoneName,
  });
  assert(validPreVal && validPreVal.is_valid === true, "TEST 2.1: Valid Surabaya polygon pre-validation succeeds");
  assert(validPreVal.metrics.area_km2 > 0, "TEST 2.2: Computed zone area in KM² is positive");
  assert(validPreVal.metrics.max_distance_from_hub_km <= validPreVal.metrics.radius_limit_km, "TEST 2.3: Max distance from hub is within radius limit");

  // TEST 2.4: Polygon outside operational radius
  const farPreVal = await zoneService.preValidateZonePolygon({
    polygon: farAwayPolygon,
    name: "Zona Jakarta Far",
  });
  assert(farPreVal && farPreVal.is_valid === false, "TEST 2.4: Polygon outside operational radius fails pre-validation");

  // TEST 2.5: Malformed polygon
  const malformedPreVal = await zoneService.preValidateZonePolygon({
    polygon: malformedPolygon,
    name: "Zona Rusak",
  });
  assert(malformedPreVal && malformedPreVal.is_valid === false, "TEST 2.5: Malformed polygon rejected during pre-validation");

  // -------------------------------------------------------------
  // GROUP 3: Zone Creation & Capacity Rules (ZONE-001, ZONE-003, ZONE-004)
  // -------------------------------------------------------------
  console.log("\n🏗️ [GROUP 3] Zone Creation & Capacity Constraints");

  // TEST 3.1: Reject invalid capacity (< 1)
  let invalidCapCaught = false;
  try {
    await zoneService.createZone({
      name: "Zona Kapasitas Nol",
      max_capacity: 0,
      polygon: validSurabayaPolygon,
    });
  } catch (err: any) {
    if (err.statusCode === 400) invalidCapCaught = true;
  }
  assert(invalidCapCaught, "TEST 3.1: Zone creation with max_capacity < 1 rejected (HTTP 400)");

  // TEST 3.2: Reject creation with polygon outside operational radius
  let outsideRadiusCaught = false;
  try {
    await zoneService.createZone({
      name: "Zona Luar Jangkauan",
      max_capacity: 5,
      polygon: farAwayPolygon,
    });
  } catch (err: any) {
    if (err.statusCode === 400 || err.statusCode === 422) outsideRadiusCaught = true;
  }
  assert(outsideRadiusCaught, "TEST 3.2: Zone creation outside operational radius rejected (HTTP 400/422)");

  // TEST 3.3: Successfully create valid zone
  const createdZone = await zoneService.createZone({
    name: validZoneName,
    description: "Zona pengujian operasional Gubeng",
    max_capacity: 6,
    status: "ACTIVE",
    polygon: validSurabayaPolygon,
  });
  assert(createdZone && typeof createdZone.id !== "undefined", "TEST 3.3: Valid zone created successfully");
  assert(createdZone.name === validZoneName, "TEST 3.4: Created zone name matches input");
  assert(parseInt(createdZone.max_capacity, 10) === 6, "TEST 3.5: Created zone capacity is 6");
  createdZoneId = createdZone.id;

  // TEST 3.6: Reject duplicate zone name
  let duplicateNameCaught = false;
  try {
    await zoneService.createZone({
      name: validZoneName,
      max_capacity: 5,
      polygon: validSurabayaPolygon,
    });
  } catch (err: any) {
    if (err.statusCode === 400) duplicateNameCaught = true;
  }
  assert(duplicateNameCaught, "TEST 3.6: Duplicate zone name rejected (HTTP 400)");

  // -------------------------------------------------------------
  // GROUP 4: Zone Updates, Capacity Adjustment & Status Toggle (ZONE-007, ZONE-008)
  // -------------------------------------------------------------
  console.log("\n⚡ [GROUP 4] Zone Updates, Capacity Quick-Update & Status Toggle");

  // TEST 4.1: Fetch zone by ID
  const fetchedZone = await zoneService.getZoneById(createdZoneId);
  assert(fetchedZone && String(fetchedZone.id) === String(createdZoneId), "TEST 4.1: Retrieve created zone by ID succeeds");

  // TEST 4.2: Quick Capacity Update (PATCH /api/zones/:id/capacity)
  const updatedCapZone = await ZoneModel.updateCapacity(createdZoneId, 12);
  assert(updatedCapZone && parseInt(updatedCapZone.max_capacity, 10) === 12, "TEST 4.2: Quick capacity update modifies capacity to 12");

  // TEST 4.3: Toggle status to INACTIVE
  const inactiveZone = await ZoneModel.updateStatus(createdZoneId, "INACTIVE");
  assert(inactiveZone && inactiveZone.status === "INACTIVE", "TEST 4.3: Zone status toggled to INACTIVE");

  // TEST 4.4: Toggle status back to ACTIVE
  const activeZone = await ZoneModel.updateStatus(createdZoneId, "ACTIVE");
  assert(activeZone && activeZone.status === "ACTIVE", "TEST 4.4: Zone status toggled back to ACTIVE");

  // -------------------------------------------------------------
  // GROUP 5: Zone Catalog & Deletion (ZONE-001)
  // -------------------------------------------------------------
  console.log("\n🗑️ [GROUP 5] Zone Listing & Deletion");

  const { zones, total } = await zoneService.getAllZones();
  assert(zones && total >= 1, "TEST 5.1: Zone catalog listing returns array of zones");

  const deletedZone = await ZoneModel.delete(createdZoneId);
  assert(deletedZone && String(deletedZone.id) === String(createdZoneId), "TEST 5.2: Zone successfully deleted");

  let notFoundCaught = false;
  try {
    await zoneService.getZoneById(createdZoneId);
  } catch (err: any) {
    if (err.statusCode === 404) notFoundCaught = true;
  }
  assert(notFoundCaught, "TEST 5.3: Deleted zone safely returns HTTP 404 Not Found");

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 04 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 04 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 04 TESTS FAILED.");
    process.exit(1);
  }
}

runPart04Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 04 test execution:", err);
  process.exit(1);
});
