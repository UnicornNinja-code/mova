import { riderOperationalService } from "../../src/services/rider/RiderOperationalService.js";
import { distributionService } from "../../src/services/distribution/DistributionService.js";
import { distributionRepository } from "../../src/repositories/distributionRepository.js";
import { pool } from "../../src/config/database.js";

async function testRiderOperationalEngine() {
  console.log("Starting rider operational test");

  try {
    // 1. Reset Today's Distribution & Session State
    await distributionRepository.resetTodayDistribution();
    console.log("Reset distribution and assignment data succeeded.");

    // Fetch existing Riders & Armadas
    const { rows: riders } = await pool.query("SELECT id, name, username FROM users WHERE role = 'RIDER' LIMIT 2;");
    const { rows: armadas } = await pool.query("SELECT id, code, type, status FROM armadas WHERE status = 'ACTIVE' LIMIT 2;");
    const { rows: products } = await pool.query("SELECT id, name, price FROM products LIMIT 1;");

    if (riders.length < 2 || armadas.length < 1 || products.length < 1) {
      console.log("Missing required seed data (riders, armadas, or products). Run db:seed.");
      process.exit(0);
    }

    const rider1 = riders[0];
    const rider2 = riders[1];
    const armadaTarget = armadas[0];
    const productSample = products[0];

    console.log(`Rider 1: '${rider1.name}' (${rider1.id})`);
    console.log(`Rider 2: '${rider2.name}' (${rider2.id})`);
    console.log(`Armada Target: '${armadaTarget.code}' (ID: ${armadaTarget.id})`);

    // 2. Rider Duty Confirmation & Auto Distribution
    await distributionService.confirmRiderDuty(rider1.id);
    await distributionService.confirmRiderDuty(rider2.id);
    await distributionService.autoDistributeRiders();

    // 3. Ticket-Booking Temporary Lock: Rider 1 Holds Armada Target
    console.log(`TEST 1: Rider 1 holds armada ${armadaTarget.code} (ticket-booking hold)`);
    const holdRes = await riderOperationalService.inspectAndHoldArmada({ riderId: rider1.id, armadaId: armadaTarget.id });
    console.log(`PASS ${holdRes.message}`);

    // 4. Lock Guard Verification for Rider 2
    console.log(`TEST 2: Rider 2 verifies catalog status for armada ${armadaTarget.code}`);
    const catalogR2 = await riderOperationalService.getHubArmadaCatalog(rider2.id);
    const targetInCatalogR2 = catalogR2.armadas.find((a) => a.id === armadaTarget.id);
    console.log(`Catalog status - Claimable: ${targetInCatalogR2.is_claimable} | Faded Out: ${targetInCatalogR2.is_faded_out}`);

    console.log(`TEST 2B: Rider 2 attempts to hold the same armada`);
    try {
      await riderOperationalService.inspectAndHoldArmada({ riderId: rider2.id, armadaId: armadaTarget.id });
      console.error("FAIL: Rider 2 should not be able to hold an armada already held by Rider 1");
    } catch (err) {
      console.log(`PASS prevented double claim: ${err.message}`);
    }

    // 5. Cancel Hold
    console.log(`TEST 3: Rider 1 cancels hold`);
    const cancelRes = await riderOperationalService.cancelArmadaHold({ riderId: rider1.id, armadaId: armadaTarget.id });
    console.log(`PASS ${cancelRes.message}`);

    // 6. Confirm Permanent Claim
    console.log(`TEST 4: Rider 1 permanently claims armada`);
    await riderOperationalService.inspectAndHoldArmada({ riderId: rider1.id, armadaId: armadaTarget.id });
    const claimRes = await riderOperationalService.confirmArmadaClaim({ riderId: rider1.id, armadaId: armadaTarget.id });
    console.log(`PASS ${claimRes.message}`);

    // 7. Geofence Check-in OUTSIDE Boundary
    console.log(`TEST 5: Rider 1 attempts check-in outside zone`);
    try {
      await riderOperationalService.checkInToZone({ riderId: rider1.id, lat: -7.5000, lon: 112.5000 });
      console.error("FAIL: Check-in should be rejected outside polygon");
    } catch (err) {
      console.log(`PASS rejected outside check-in: ${err.message}`);
    }

    // 8. Geofence Check-in INSIDE Boundary
    console.log(`TEST 6: Rider 1 check-in inside zone`);
    const checkInRes = await riderOperationalService.checkInToZone({ riderId: rider1.id, lat: -7.4478, lon: 112.7183 });
    console.log(`PASS ${checkInRes.message}`);

    // 9. Record Daily Product Sales Log
    console.log(`TEST 7: Rider 1 records product sale`);
    const saleRes = await riderOperationalService.recordProductSale({ riderId: rider1.id, productId: productSample.id, quantity: 5, unitPrice: productSample.price });
    console.log(`PASS ${saleRes.message} Total: Rp${saleRes.sales_log.total_price}`);

    // 10. Checkout Session & Return Armada
    console.log(`TEST 8: Rider 1 checkout and return armada`);
    const checkoutRes = await riderOperationalService.checkoutAndReturnArmada({ riderId: rider1.id, returnStatus: "ACTIVE", notes: "Session complete." });
    console.log(`PASS ${checkoutRes.message}`);

    console.log("Rider operational test completed");

  } catch (error) {
    console.error("FAIL Rider operational test", error && error.message ? error.message : error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testRiderOperationalEngine();
