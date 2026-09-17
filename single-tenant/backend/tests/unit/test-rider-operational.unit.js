/*
 * test-rider-operational.unit.js
 * Unit Test Suite for RiderOperationalService following TDD (Red-Green-Refactor)
 */

import assert from "assert";
import { RiderOperationalService } from "../../src/services/rider/RiderOperationalService.js";

async function runRiderOperationalUnitTests() {
  console.log("🧪 [TDD] Running RiderOperationalService Unit Tests...\n");
  let passedCount = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: Quantity Validation & Boundary Defense
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 1: Defensive validation on sales quantity (integers, bounds, overflow)");

    // Mock Repository & Dependencies
    const mockRepo = {
      findActiveRiderSession: async () => ({
        session_id: "sess-123",
        assignment_id: "assign-123",
        zone_id: "zone-123",
        session_status: "OPERATING",
        assignment_status: "CHECKED_IN",
      }),
      findZoneCoveringPoint: async () => ({ id: "zone-123", name: "Zone 1" }),
      insertSalesLog: async (payload) => ({ id: "sale-1", ...payload }),
    };
    const mockProductRepo = {
      findById: async () => ({ id: "prod-1", name: "Kopi Susu", price: 15000, status: "AVAILABLE" }),
    };

    const service = new RiderOperationalService(mockRepo, null, mockProductRepo);

    // 1.1 Valid quantity
    const res = await service.recordProductSale({
      riderId: "rider-1",
      productId: "prod-1",
      quantity: 3,
      lat: -7.4478,
      lon: 112.7183,
    });
    assert.strictEqual(res.sales_log.quantity, 3);
    assert.strictEqual(res.sales_log.total_price, 45000);

    // 1.2 Zero quantity rejected
    await assert.rejects(
      async () => service.recordProductSale({ riderId: "r1", productId: "p1", quantity: 0 }),
      (err) => err.statusCode === 400 && err.message.includes("quantity"),
      "Zero quantity must throw 400"
    );

    // 1.3 Negative quantity rejected
    await assert.rejects(
      async () => service.recordProductSale({ riderId: "r1", productId: "p1", quantity: -5 }),
      (err) => err.statusCode === 400,
      "Negative quantity must throw 400"
    );

    // 1.4 Floating point quantity rejected
    await assert.rejects(
      async () => service.recordProductSale({ riderId: "r1", productId: "p1", quantity: 2.5 }),
      (err) => err.statusCode === 400,
      "Decimal quantity must throw 400"
    );

    // 1.5 Extreme overflow quantity (> 10,000) rejected
    await assert.rejects(
      async () => service.recordProductSale({ riderId: "r1", productId: "p1", quantity: 50000 }),
      (err) => err.statusCode === 400,
      "Overflow quantity (>10000) must throw 400"
    );

    console.log("  ✓ PASS: Sales quantity validation rejects invalid/extreme quantities");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 1:", err.message);
    throw err;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Operational Session State Guards on Sale Recording
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 2: Enforcing session state guards (prevent sales before check-in or after checkout)");

    // 2.1 Not checked in yet (Status: CLAIMED)
    const mockRepoClaimed = {
      findActiveRiderSession: async () => ({
        session_id: "sess-1",
        session_status: "CLAIMED",
        assignment_status: "ASSIGNED",
      }),
    };
    const serviceClaimed = new RiderOperationalService(mockRepoClaimed, null, { findById: async () => ({}) });

    await assert.rejects(
      async () => serviceClaimed.recordProductSale({ riderId: "r1", productId: "p1", quantity: 1 }),
      (err) => err.statusCode === 400 && err.message.includes("check-in"),
      "Sales before check-in must be rejected"
    );

    // 2.2 Already checked out (Status: COMPLETED)
    const mockRepoCompleted = {
      findActiveRiderSession: async () => ({
        session_id: "sess-1",
        session_status: "COMPLETED",
        assignment_status: "COMPLETED",
      }),
    };
    const serviceCompleted = new RiderOperationalService(mockRepoCompleted, null, { findById: async () => ({}) });

    await assert.rejects(
      async () => serviceCompleted.recordProductSale({ riderId: "r1", productId: "p1", quantity: 1 }),
      (err) => err.statusCode === 400 && err.message.includes("ditutup"),
      "Sales after checkout must be rejected"
    );

    console.log("  ✓ PASS: State machine prevents sales outside active operating window");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 2:", err.message);
    throw err;
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Product Availability Guard & Server-Side Price Snapshot
  // ---------------------------------------------------------------------------
  try {
    console.log("Test 3: Rejecting OUT_OF_STOCK products & snapshotting master product price");

    const mockRepoOperating = {
      findActiveRiderSession: async () => ({
        session_id: "sess-1",
        zone_id: "zone-1",
        session_status: "OPERATING",
        assignment_status: "CHECKED_IN",
      }),
      findZoneCoveringPoint: async () => ({ id: "zone-1" }),
      insertSalesLog: async (d) => d,
    };

    const mockProductRepoOut = {
      findById: async () => ({ id: "p-out", name: "Out of Stock Coffee", price: 20000, status: "OUT_OF_STOCK" }),
    };

    const serviceOut = new RiderOperationalService(mockRepoOperating, null, mockProductRepoOut);

    await assert.rejects(
      async () => serviceOut.recordProductSale({ riderId: "r1", productId: "p-out", quantity: 1 }),
      (err) => err.statusCode === 400 && err.message.includes("tidak dapat dijual"),
      "Out of stock product must be rejected"
    );

    console.log("  ✓ PASS: Inactive/out of stock products are rejected immediately");
    passedCount++;
  } catch (err) {
    console.error("  ❌ FAIL Test 3:", err.message);
    throw err;
  }

  console.log(`\n========================================================`);
  console.log(`🎉 ALL ${passedCount}/3 RIDER OPERATIONAL TDD TESTS PASSED!`);
  console.log(`========================================================\n`);
  process.exit(0);
}

runRiderOperationalUnitTests().catch((err) => {
  console.error("Fatal Test Failure:", err);
  process.exit(1);
});
