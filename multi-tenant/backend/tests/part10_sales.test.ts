/*
 * part10_sales.test.ts
 * Comprehensive Integration & Verification Test Suite for PART 10:
 * Product Catalog CRUD, Deletion Guard (Historical Sales Protection),
 * Server-side Price Calculation, Immutable Unit Price Snapshotting,
 * and Sales Overview SQL Aggregations.
 */

import { pool } from "../src/config/database.js";
import { productService } from "../src/services/product/ProductService.js";
import { riderOperationalService } from "../src/services/rider/RiderOperationalService.js";
import { salesService } from "../src/services/sales/SalesService.js";
import { distributionService } from "../src/services/distribution/DistributionService.js";
import { distributionRepository } from "../src/repositories/distributionRepository.js";
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

async function runPart10Tests() {
  console.log("\n========================================================");
  console.log("🧪 RUNNING PART 10: SALES & TRANSACTION TEST SUITE");
  console.log("========================================================\n");

  const testSuffix = Date.now();
  let testProductId: string | number = "";
  let testZoneId: string | number = "";
  let testRiderId: string = "";
  let testAssignmentId: string = "";

  // -------------------------------------------------------------
  // GROUP 1: Product Catalog Management & Deletion Guard (SALES-007, SALES-008)
  // -------------------------------------------------------------
  console.log("☕ [GROUP 1] Product Catalog CRUD & Deletion Guard");

  // 1. Create Product
  const createdProd = await productService.createProduct({
    name: `Test Kopi Susu ${testSuffix}`,
    sku: `SKU-${testSuffix}`,
    category: "COFFEE",
    price: 18000,
    base_price: 10000,
    description: "Kopi susu gula aren premium",
    status: "AVAILABLE",
  });
  testProductId = createdProd.id;
  assert(createdProd && createdProd.id, "TEST 1.1: Product created successfully");
  assert(parseFloat(createdProd.price) === 18000, "TEST 1.2: Product price is set to 18000");

  // 2. Update Product
  const updatedProd = await productService.updateProduct(testProductId, {
    description: "Kopi susu gula aren premium updated",
  });
  assert(updatedProd.description.includes("updated"), "TEST 1.3: Product details updated successfully");

  // 3. Status toggle (AVAILABLE -> DISCONTINUED -> AVAILABLE)
  const toggled = await productService.updateProductStatus(testProductId, "DISCONTINUED");
  assert(toggled.status === "DISCONTINUED", "TEST 1.4: Product status toggled to DISCONTINUED");
  await productService.updateProductStatus(testProductId, "AVAILABLE");

  // -------------------------------------------------------------
  // SETUP: Create Zone, Rider, and Check-in for Sales Recording
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM weathers WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'Sales Test Zone%');");
    await pool.query("DELETE FROM zone_assignments WHERE zone_id IN (SELECT id FROM zones WHERE name LIKE 'Sales Test Zone%');");
    await pool.query("DELETE FROM zones WHERE name LIKE 'Sales Test Zone%';");
  } catch (e) {}

  const zone = await zoneService.createZone({
    name: `Sales Test Zone ${testSuffix}`,
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
  testZoneId = zone.id;

  const userRes = await pool.query(`
    INSERT INTO users (id, username, name, email, password, role, is_active)
    VALUES (gen_random_uuid(), $1, 'Sales Rider', $2, 'hash', 'RIDER', true)
    RETURNING id;
  `, [`sales_rider_${testSuffix}`, `sales_rider_${testSuffix}@koling.com`]);
  testRiderId = userRes.rows[0].id;

  await distributionRepository.addRiderToDutyQueue(testRiderId);
  const manualAssign = await distributionService.manualDistributeRider({
    riderId: testRiderId,
    zoneId: testZoneId,
    assignedBy: null,
  });
  testAssignmentId = manualAssign.assignment.id;

  // -------------------------------------------------------------
  // GROUP 2: Sales Recording & Server-Side Pricing (SALES-001, SALES-002, SALES-003, SALES-006)
  // -------------------------------------------------------------
  console.log("\n💰 [GROUP 2] Sales Recording & Server-Side Price Calculation");

  // 1. Rider without check-in -> MUST FAIL (400)
  let checkInRequiredError = false;
  try {
    await riderOperationalService.recordProductSale({
      riderId: testRiderId,
      productId: testProductId,
      quantity: 2,
    });
  } catch (err: any) {
    checkInRequiredError = true;
    assert(err.statusCode === 400 || err.message.toLowerCase().includes("check-in"), "TEST 2.1: Sale recording before check-in rejected with 400 error");
  }
  assert(checkInRequiredError, "TEST 2.2: Rider must be CHECKED_IN to record sales");

  // 2. Perform Geofenced Check-in
  await riderOperationalService.checkInToZone({
    riderId: testRiderId,
    lat: -7.2680,
    lon: 112.7500,
  });

  // 3. Record Sale (qty = 3, price = 18000 -> total = 54000)
  const saleRes = await riderOperationalService.recordProductSale({
    riderId: testRiderId,
    productId: testProductId,
    quantity: 3,
    lat: -7.2680,
    lon: 112.7500,
  });

  const sale = saleRes.sales_log;
  assert(sale && sale.id, "TEST 2.3: Sale recorded successfully");
  assert(parseFloat(sale.unit_price) === 18000, "TEST 2.4: Unit price snapshotted from product table (18000)");
  assert(parseFloat(sale.total_price) === 54000, "TEST 2.5: Total price calculated server-side (3 × 18000 = 54000)");
  assert(sale.zone_id === testZoneId, "TEST 2.6: Sale linked to current zone_id");

  // 4. Update Product price to 25000; verify past sale snapshot remains 18000
  await productService.updateProduct(testProductId, { price: 25000 });
  const { rows: saleCheck } = await pool.query("SELECT * FROM sales_logs WHERE id = $1;", [sale.id]);
  assert(parseFloat(saleCheck[0].unit_price) === 18000, "TEST 2.7: Past sales record unit price remains unchanged after product price update");

  // -------------------------------------------------------------
  // GROUP 3: Historical Sales Deletion Protection (SALES-009)
  // -------------------------------------------------------------
  console.log("\n🛡️ [GROUP 3] Historical Sales Deletion Protection");

  let deletionBlocked = false;
  try {
    await productService.deleteProduct(testProductId);
  } catch (err: any) {
    deletionBlocked = true;
    assert(err.statusCode === 400 || err.message.toLowerCase().includes("histori"), "TEST 3.1: Deletion of product with historical sales blocked (400)");
  }
  assert(deletionBlocked, "TEST 3.2: Product with sales records cannot be deleted");

  // -------------------------------------------------------------
  // GROUP 4: Sales Overview & Analytics (SALES-004, SALES-005)
  // -------------------------------------------------------------
  console.log("\n📈 [GROUP 4] Sales Overview & Personal Shift History");

  const overview = await salesService.getSalesOverview({
    riderId: testRiderId,
  });
  assert(overview && overview.summary, "TEST 4.1: Sales overview returns summary analytics");
  assert(overview.summary.total_units_sold >= 3, "TEST 4.2: Total units sold aggregated correctly");
  assert(parseFloat(overview.summary.total_revenue) >= 54000, "TEST 4.3: Total revenue aggregated correctly");

  const riderHistory = await riderOperationalService.getMySalesHistory({
    riderId: testRiderId,
  });
  assert(riderHistory && Array.isArray(riderHistory.sales), "TEST 4.4: Personal sales history returns sales list");
  assert(riderHistory.sales.length >= 1, "TEST 4.5: Personal sales list contains recorded transaction");

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  try {
    await pool.query("DELETE FROM sales_logs WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM zone_assignments WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM rider_duty_queues WHERE rider_id = $1;", [testRiderId]);
    await pool.query("DELETE FROM products WHERE id = $1;", [testProductId]);
    await pool.query("DELETE FROM users WHERE id = $1;", [testRiderId]);
    await ZoneModel.delete(testZoneId);
  } catch (err: any) {
    console.warn("Cleanup warning:", err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n========================================================");
  console.log(`📊 PART 10 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log("========================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL PART 10 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME PART 10 TESTS FAILED.");
    process.exit(1);
  }
}

runPart10Tests().catch((err) => {
  console.error("💥 Unhandled error during PART 10 test execution:", err);
  process.exit(1);
});
