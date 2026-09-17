/*
 * test_operational_scope.ts
 * Comprehensive Verification of Authoritative Operational Scope Architecture
 */

import { operationalContextService, OperationalConfigurationError } from '../src/services/spatial/OperationalContextService.js';
import { spatialValidationService } from '../src/services/spatial/SpatialValidationService.js';
import { POIEltPipelineService } from '../src/services/poiService.js';
import { POIDistanceService } from '../src/services/poi/POIDistanceService.js';
import { ZoneService } from '../src/services/zoneService.js';
import { systemReadinessService } from '../src/services/system/systemReadinessService.js';
import { SystemSettingModel } from '../src/models/systemSettingModel.js';
import { pool } from '../src/config/database.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`, detail || '');
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE OPERATIONAL SCOPE VERIFICATION');
  console.log('======================================================\n');

  // TEST 1: Authoritative Operational Context Resolution (Surabaya)
  const context = await operationalContextService.getOperationalContext(true);
  assert(context.hubCityName === 'Surabaya', 'TEST 1.1: Operational Context hubCityName must be "Surabaya"', context.hubCityName);
  assert(context.centralHubAddress.includes('Surabaya'), 'TEST 1.2: Central Hub address must contain "Surabaya"', context.centralHubAddress);
  assert(Math.abs(context.latitude - (-7.246284)) < 0.05, 'TEST 1.3: Central Hub latitude matches Surabaya coordinates', context.latitude);
  assert(Math.abs(context.longitude - 112.737767) < 0.05, 'TEST 1.4: Central Hub longitude matches Surabaya coordinates', context.longitude);
  assert(context.bbox.minLat < -7.2 && context.bbox.maxLat > -7.3, 'TEST 1.5: Bounding Box is centered in Surabaya region', context.bbox);

  // TEST 2: POI Service Dynamic Hub Resolution
  const poiService = new POIEltPipelineService();
  const activeCity = await poiService.getActiveHubCity();
  assert(activeCity === 'Surabaya', 'TEST 2.1: poiService.getActiveHubCity() must return "Surabaya"', activeCity);

  const overrideCity = await poiService.getActiveHubCity('Malang');
  assert(overrideCity === 'Malang', 'TEST 2.2: poiService.getActiveHubCity("Malang") respects explicit override', overrideCity);

  // TEST 3: Distance Service (Criteria C5) Coordinates
  const distService = POIDistanceService.getInstance();
  const hubCoords = await distService.getHubCoordinates();
  assert(Math.abs(hubCoords.latitude - (-7.246284)) < 0.05, 'TEST 3.1: POIDistanceService latitude must match Surabaya Hub', hubCoords);
  assert(Math.abs(hubCoords.longitude - 112.737767) < 0.05, 'TEST 3.2: POIDistanceService longitude must match Surabaya Hub', hubCoords);

  // TEST 4: Spatial Validation Bounding Box Resolution
  const defaultBbox = await spatialValidationService.resolveBoundingBox();
  assert(defaultBbox.minLat === -7.36 && defaultBbox.maxLat === -7.18, 'TEST 4.1: Default resolveBoundingBox() returns Surabaya preset', defaultBbox);

  const explicitSidoarjoBbox = await spatialValidationService.resolveBoundingBox('Sidoarjo');
  assert(explicitSidoarjoBbox.minLat === -7.58 && explicitSidoarjoBbox.maxLat === -7.33, 'TEST 4.2: Explicit "Sidoarjo" returns Sidoarjo preset', explicitSidoarjoBbox);

  // TEST 5: Zone Service Operational Bounds & Validation
  const zoneService = ZoneService.getInstance();
  const bounds = await zoneService.getZoneConfig();
  assert(bounds.hub_city_name === 'Surabaya', 'TEST 5.1: zoneService.getZoneConfig() hub_city_name is "Surabaya"', bounds.hub_city_name);
  assert(Math.abs(bounds.hub_latitude - (-7.246284)) < 0.05, 'TEST 5.2: zoneService latitude is Surabaya Hub', bounds.hub_latitude);

  // Test validateZoneGeometry with a point in Surabaya
  const surabayaPolygon = JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [112.74, -7.21],
      [112.76, -7.21],
      [112.76, -7.22],
      [112.74, -7.22],
      [112.74, -7.21]
    ]]
  });
  const geomValidation = await zoneService.checkOperationalCoverage(surabayaPolygon);
  assert(geomValidation.is_within_radius === true, 'TEST 5.3: Zone inside Surabaya is within radius of Surabaya Hub', geomValidation);

  // TEST 6: System Readiness Report includes city_name
  const readiness = await systemReadinessService.evaluateSystemReadiness();
  assert(readiness.hub_config.city_name === 'Surabaya', 'TEST 6.1: systemReadinessService returns city_name="Surabaya"', readiness.hub_config.city_name);

  // TEST 7: Missing Configuration Fail-Safe (Zero silent fallback)
  const mockService = new (operationalContextService.constructor as any)();
  mockService.setDbPool({
    query: async () => ({ rows: [] })
  });

  let threwExpected = false;
  try {
    await mockService.getOperationalContext(true);
  } catch (err: any) {
    if (err instanceof OperationalConfigurationError && err.statusCode === 422) {
      threwExpected = true;
    }
  }
  assert(threwExpected === true, 'TEST 7.1: Missing operational configuration safely throws OperationalConfigurationError (422)');

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('💥 SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('💥 Fatal error in test suite:', err);
  process.exit(1);
});
