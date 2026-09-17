/*
 * test-lbs-geofence.unit.js
 * Unit Test Suite for LbsGeofenceService following TDD (Red-Green-Refactor)
 */

import assert from "assert";
import { LbsGeofenceService } from "../../src/services/lbs/LbsGeofenceService.js";

async function runUnitTests() {
  console.log("🧪 [TDD] Running LbsGeofenceService Unit Tests...\n");
  let passedCount = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: Coordinate Normalization & Validation (Valid inputs)
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 1: Normalizing valid coordinates (lat/lon and latitude/longitude aliases)");
    const service = new LbsGeofenceService();
    
    // Alias 1: lat, lon
    const res1 = service.parseAndValidatePing({ lat: -7.4478, lon: 112.7183, speed: 25.5, heading: 90 });
    assert.strictEqual(res1.latitude, -7.4478);
    assert.strictEqual(res1.longitude, 112.7183);
    assert.strictEqual(res1.speed, 25.5);
    assert.strictEqual(res1.heading, 90);

    // Alias 2: latitude, longitude
    const res2 = service.parseAndValidatePing({ latitude: "-7.5000", longitude: "112.8000", speed: -5, heading: 450 });
    assert.strictEqual(res2.latitude, -7.5);
    assert.strictEqual(res2.longitude, 112.8);
    assert.strictEqual(res2.speed, 0, "Negative speed should be clamped to 0");
    assert.strictEqual(res2.heading, 90, "Heading 450 should wrap to 90 degrees");

    console.log("  ✓ PASS: Coordinate and telemetry normalization works as expected");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 1:", err.message);
    throw err;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Invalid Coordinate Rejection (Out of bounds & NaN)
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 2: Rejecting invalid coordinates with 400 Bad Request");
    const service = new LbsGeofenceService();

    assert.throws(
      () => service.parseAndValidatePing({ latitude: 95, longitude: 112.7 }),
      (err) => err.statusCode === 400 && err.message.includes("latitude"),
      "Latitude > 90 must throw 400"
    );

    assert.throws(
      () => service.parseAndValidatePing({ latitude: -7.4, longitude: 190 }),
      (err) => err.statusCode === 400 && err.message.includes("longitude"),
      "Longitude > 180 must throw 400"
    );

    assert.throws(
      () => service.parseAndValidatePing({ latitude: "invalid", longitude: 112.7 }),
      (err) => err.statusCode === 400,
      "Non-numeric coordinate must throw 400"
    );

    console.log("  ✓ PASS: Boundary and invalid coordinate exceptions thrown correctly");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 2:", err.message);
    throw err;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Pure Zone Compliance Evaluation Matrix
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 3: Evaluating Zone Compliance Matrix (COMPLIANT, DEVIATED, OUTSIDE_ZONE)");
    const service = new LbsGeofenceService();

    // Scenario A: Rider in assigned zone
    const compA = service.determineZoneCompliance({ actualZoneId: "zone-1", assignedZoneId: "zone-1" });
    assert.strictEqual(compA, "COMPLIANT");

    // Scenario B: Rider in different zone
    const compB = service.determineZoneCompliance({ actualZoneId: "zone-2", assignedZoneId: "zone-1" });
    assert.strictEqual(compB, "DEVIATED");

    // Scenario C: Rider in zone without specific assignment
    const compC = service.determineZoneCompliance({ actualZoneId: "zone-1", assignedZoneId: null });
    assert.strictEqual(compC, "COMPLIANT");

    // Scenario D: Rider outside all zones
    const compD = service.determineZoneCompliance({ actualZoneId: null, assignedZoneId: "zone-1" });
    assert.strictEqual(compD, "OUTSIDE_ZONE");

    console.log("  ✓ PASS: Compliance evaluation produces deterministic results");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 3:", err.message);
    throw err;
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Discrete State Transition Event Detection Machine
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 4: State Transition Machine (ENTER, DEVIATED_ENTER, EXIT, NONE)");
    const service = new LbsGeofenceService();

    // 4.1 Initial Entry (No previous log)
    const ev1 = service.determineDiscreteEvent({
      lastLog: null,
      isInsideZone: true,
      currentZoneId: "zone-1",
      currentCompliance: "COMPLIANT",
    });
    assert.strictEqual(ev1, "ENTER", "Initial entry into assigned zone must emit ENTER");

    // 4.2 Continuous inside same zone with same compliance (No state change)
    const ev2 = service.determineDiscreteEvent({
      lastLog: { zone_id: "zone-1", zone_compliance: "COMPLIANT", event_type: "ENTER" },
      isInsideZone: true,
      currentZoneId: "zone-1",
      currentCompliance: "COMPLIANT",
    });
    assert.strictEqual(ev2, "NONE", "Redundant ping inside same zone must return NONE");

    // 4.3 Transition to DEVIATED zone
    const ev3 = service.determineDiscreteEvent({
      lastLog: { zone_id: "zone-1", zone_compliance: "COMPLIANT", event_type: "ENTER" },
      isInsideZone: true,
      currentZoneId: "zone-2",
      currentCompliance: "DEVIATED",
    });
    assert.strictEqual(ev3, "DEVIATED_ENTER", "Moving to different zone must emit DEVIATED_ENTER");

    // 4.4 Exit all zones
    const ev4 = service.determineDiscreteEvent({
      lastLog: { zone_id: "zone-1", zone_compliance: "COMPLIANT", event_type: "ENTER" },
      isInsideZone: false,
      currentZoneId: null,
      currentCompliance: "OUTSIDE_ZONE",
    });
    assert.strictEqual(ev4, "EXIT", "Leaving zones must emit EXIT");

    // 4.5 Subsequent ping while still outside
    const ev5 = service.determineDiscreteEvent({
      lastLog: { zone_id: "zone-1", zone_compliance: "OUTSIDE_ZONE", event_type: "EXIT" },
      isInsideZone: false,
      currentZoneId: null,
      currentCompliance: "OUTSIDE_ZONE",
    });
    assert.strictEqual(ev5, "NONE", "Subsequent out-of-zone pings must return NONE");

    console.log("  ✓ PASS: Discrete event state machine satisfies all transition invariants");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 4:", err.message);
    throw err;
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Geodesic Distance Haversine Calculator
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 5: Computing Geodesic Haversine Distance between coordinates");
    const service = new LbsGeofenceService();

    // Sidoarjo Hub (-7.4478, 112.7183) to Surabaya Central (-7.2575, 112.7521) ~ 21.4 km
    const distMeters = service.calculateGeodesicDistance(
      { lat: -7.4478, lon: 112.7183 },
      { lat: -7.2575, lon: 112.7521 }
    );
    assert(distMeters > 20000 && distMeters < 23000, `Distance should be ~21.4km, got ${distMeters}m`);

    // Same point -> 0 meters
    const distZero = service.calculateGeodesicDistance(
      { lat: -7.4478, lon: 112.7183 },
      { lat: -7.4478, lon: 112.7183 }
    );
    assert.strictEqual(distZero, 0, "Distance to self must be exactly 0");

    console.log("  ✓ PASS: Geodesic Haversine distance matches expected precision");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 5:", err.message);
    throw err;
  }

  console.log(`\n========================================================`);
  console.log(`🎉 ALL ${passedCount}/5 TDD UNIT TESTS PASSED!`);
  console.log(`========================================================\n`);
  process.exit(0);
}

runUnitTests().catch((err) => {
  console.error("Fatal Test Failure:", err);
  process.exit(1);
});
