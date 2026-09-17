import "dotenv/config";
import http from "http";
import { app } from "../../index.js";
import { pool } from "../../src/config/database.js";

const PORT = process.env.PORT || 9002;
const BASE_URL = `http://localhost:${PORT}`;

async function runStateIntegrityTests() {
  console.log(`\n======================================================`);
  console.log(`Starting Phase 2: Operational Domain & State Integrity Test Suite`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passedCount = 0;
  let failedCount = 0;
  let localServer = null;

  try {
    // Check if server is already running, if not start in-process
    try {
      await fetch(`${BASE_URL}/api/poi-categories`, { signal: AbortSignal.timeout(1500) });
    } catch {
      console.log(`Starting test server in-process on port ${PORT}...`);
      localServer = http.createServer(app);
      await new Promise((resolve) => localServer.listen(PORT, resolve));
      console.log(`Test server running at ${BASE_URL}\n`);
    }

    function assertTest(testName, isSuccess, details = "") {
      if (isSuccess) {
        console.log(`  ✓ PASS: ${testName}${details ? ` (${details})` : ""}`);
        passedCount++;
      } else {
        console.log(`  ✗ FAIL: ${testName}${details ? ` (${details})` : ""}`);
        failedCount++;
      }
    }

    // 1. Setup Test Users & Ensure Standard Hash (Deterministic Upsert Fixture)
    console.log(`[1] Authenticating Test Users...`);
    const bcrypt = (await import("bcrypt")).default;
    const defaultHash = await bcrypt.hash("password123", 10);
    
    // Deterministic test accounts upsert
    await pool.query(`
      INSERT INTO users (username, name, email, password, role, is_active, first_login)
      VALUES ('superadmin', 'Super Admin System', 'superadmin@kopikeliling.com', $1, 'SUPERADMIN', true, false)
      ON CONFLICT (email) DO UPDATE SET password = $1, is_active = true;
    `, [defaultHash]);

    await pool.query(`
      INSERT INTO users (username, name, email, password, role, is_active, first_login)
      VALUES ('supervisor1', 'Supervisor Test', 'supervisor@kopikeliling.com', $1, 'SUPERVISOR', true, false)
      ON CONFLICT (email) DO UPDATE SET password = $1, is_active = true;
    `, [defaultHash]);

    await pool.query(`
      INSERT INTO users (username, name, email, password, role, is_active, first_login)
      VALUES ('rider1', 'Rider Test', 'rider@kopikeliling.com', $1, 'RIDER', true, false)
      ON CONFLICT (email) DO UPDATE SET password = $1, is_active = true;
    `, [defaultHash]);

    const login = async (email, password) => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return { status: res.status, ...data };
    };

    const saLogin = await login("superadmin@kopikeliling.com", "password123");
    const superadminToken = saLogin.token;
    assertTest("Superadmin Login", !!superadminToken);

    const spvLogin = await login("supervisor@kopikeliling.com", "password123");
    const supervisorToken = spvLogin.token;
    assertTest("Supervisor Login", !!supervisorToken);

    const riderLogin = await login("rider@kopikeliling.com", "password123");
    const riderToken = riderLogin.token;
    const riderUser = riderLogin.user;
    assertTest("Rider Login", !!riderToken, `Rider ID: ${riderUser?.id}`);

    // Create a second rider for race condition testing
    const testRider2Email = `rider2_${Date.now()}@example.com`;
    const rider2Insert = await pool.query(`
      INSERT INTO users (username, name, email, password, role)
      VALUES ($1, 'Second Test Rider', $2, $3, 'RIDER')
      RETURNING *;
    `, [`rider2_${Date.now()}`, testRider2Email, defaultHash]);
    const rider2Login = await login(testRider2Email, "password123");
    const rider2Token = rider2Login.token;
    const rider2User = rider2Login.user || rider2Insert.rows[0];
    assertTest("Rider 2 Setup & Login", !!rider2Token, `Rider 2 ID: ${rider2User?.id}`);

    // 2. Ensure Master Zone, Fleet Armada & Product exist
    console.log(`\n[2] Setting Up Master Data for State Flow...`);

    // Reset today's transactional queues & assignments cleanly
    await pool.query("DELETE FROM sales_logs WHERE rider_id IN ($1, $2);", [riderUser.id, rider2User.id]);
    await pool.query("DELETE FROM zone_assignments WHERE assignment_date = CURRENT_DATE;");
    await pool.query("DELETE FROM rider_duty_queues WHERE duty_date = CURRENT_DATE;");

    // Fetch or create a test zone
    const zonesRes = await fetch(`${BASE_URL}/api/zones`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const zonesData = await zonesRes.json();
    let targetZone = (zonesData.zones || []).find((z) => z.status === "ACTIVE" && z.polygon);

    if (!targetZone) {
      // Create a test zone
      const createZoneRes = await fetch(`${BASE_URL}/api/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${superadminToken}` },
        body: JSON.stringify({
          name: "Zona State Test Sidoarjo",
          description: "Zone for state flow testing",
          max_capacity: 5,
          status: "ACTIVE",
          polygon: {
            type: "Polygon",
            coordinates: [
              [
                [112.7100, -7.4400],
                [112.7300, -7.4400],
                [112.7300, -7.4600],
                [112.7100, -7.4600],
                [112.7100, -7.4400],
              ],
            ],
          },
        }),
      });
      const createdZoneData = await createZoneRes.json();
      targetZone = createdZoneData.zone;
    }
    assertTest("Target Zone Available", !!targetZone?.id, `Zone: ${targetZone?.name}`);

    // Ensure armada exists and is ACTIVE
    let armadaRes = await pool.query("SELECT * FROM armadas WHERE status = 'ACTIVE' LIMIT 1;");
    let testArmada = armadaRes.rows[0];
    if (!testArmada) {
      const armInsert = await pool.query(`
        INSERT INTO armadas (code, type, status)
        VALUES ('ARM-STATE-01', 'GEROBAK', 'ACTIVE')
        RETURNING *;
      `);
      testArmada = armInsert.rows[0];
    }
    // Release any previous hold on testArmada
    await pool.query(`
      UPDATE armadas
      SET status = 'ACTIVE', current_rider_id = NULL, reserved_by_rider_id = NULL, reserved_until = NULL
      WHERE id = $1;
    `, [testArmada.id]);
    assertTest("Test Armada Ready (ACTIVE)", !!testArmada?.id, `Code: ${testArmada?.code}`);

    // Ensure test product exists
    let prodRes = await pool.query("SELECT * FROM products WHERE status = 'AVAILABLE' LIMIT 1;");
    let testProduct = prodRes.rows[0];
    if (!testProduct) {
      const prodInsert = await pool.query(`
        INSERT INTO products (name, description, price, status)
        VALUES ('Kopi Susu Gula Aren', 'Signature coffee', 12000, 'AVAILABLE')
        RETURNING *;
      `);
      testProduct = prodInsert.rows[0];
    }
    assertTest("Test Product Available", !!testProduct?.id, `Product: ${testProduct?.name}`);

    // 3. Stage 1: Rider Duty Confirmation (Attendance FIFO Queue)
    console.log(`\n[3] Testing Stage 1: Attendance & Duty Confirmation...`);

    const dutyConfirmRes = await fetch(`${BASE_URL}/api/distribution/duty-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({}),
    });
    const dutyConfirmData = await dutyConfirmRes.json();
    assertTest("Rider 1 Duty Confirmation", dutyConfirmRes.status === 200 && dutyConfirmData.queue?.status === "WAITING", `Queue ID: ${dutyConfirmData.queue?.id}`);

    // 4. Stage 2: Distribution / Plotting to Zone
    console.log(`\n[4] Testing Stage 2: Distribution & Assignment Creation...`);

    const manualPlotRes = await fetch(`${BASE_URL}/api/distribution/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supervisorToken}` },
      body: JSON.stringify({
        rider_id: riderUser.id,
        zone_id: targetZone.id,
      }),
    });
    const manualPlotData = await manualPlotRes.json();
    const assignmentId = manualPlotData.assignment?.id;
    assertTest("Supervisor Manual Plotting", manualPlotRes.status === 200 && manualPlotData.assignment?.status === "ASSIGNED", `Assignment ID: ${assignmentId}`);

    // Verify duty queue status became PLOTTED
    const queueCheck = await pool.query("SELECT status FROM rider_duty_queues WHERE rider_id = $1 AND duty_date = CURRENT_DATE;", [riderUser.id]);
    assertTest("Queue Transition -> PLOTTED", queueCheck.rows[0]?.status === "PLOTTED");

    // 5. Stage 3: Zone Active Rider Metric Check (Pre-Check-In)
    console.log(`\n[5] Verifying Active Rider Metric Pre-Check-In (Expected: 0)...`);

    const zonePreCheckRes = await fetch(`${BASE_URL}/api/zones/${targetZone.id}`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const zonePreCheckData = await zonePreCheckRes.json();
    assertTest("Zone Active Riders Count = 0 (Pre-Check-In)", zonePreCheckData.zone?.active_riders_count === 0, `Count: ${zonePreCheckData.zone?.active_riders_count}`);

    // 6. Stage 4: Fleet Armada Temporary Hold & Permanent Claim
    console.log(`\n[6] Testing Stage 4: Fleet Hold Lock & Claim...`);

    // Rider 1 places 5-minute hold on Armada
    const holdRes = await fetch(`${BASE_URL}/api/rider/hold-armada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ armada_id: testArmada.id }),
    });
    const holdData = await holdRes.json();
    assertTest("Rider 1 Holds Armada (RESERVED)", holdRes.status === 200 && holdData.armada?.status === "RESERVED", `Held until: ${holdData.armada?.reserved_until}`);

    // Rider 2 tries to hold the same Armada -> Must be blocked (400)
    const rivalHoldRes = await fetch(`${BASE_URL}/api/rider/hold-armada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${rider2Token}` },
      body: JSON.stringify({ armada_id: testArmada.id }),
    });
    assertTest("Rival Rider Hold Conflict Blocked", rivalHoldRes.status === 400, `Status: ${rivalHoldRes.status} (Expected 400)`);

    // Rider 1 permanently claims the Armada
    const claimRes = await fetch(`${BASE_URL}/api/rider/claim-armada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({ armada_id: testArmada.id, assignment_id: assignmentId }),
    });
    const claimData = await claimRes.json();
    assertTest("Rider 1 Claims Armada (IN_USE)", claimRes.status === 200 && claimData.armada?.status === "IN_USE", `Current Rider: ${claimData.armada?.current_rider_id}`);

    // 7. Stage 5: PostGIS Geofence Spatial Check-In
    console.log(`\n[7] Testing Stage 5: PostGIS Spatial Check-In...`);

    // Obtain a point guaranteed inside the zone polygon via PostGIS
    const pointRes = await pool.query(`
      SELECT 
        ST_X(ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(
          CASE 
            WHEN jsonb_typeof(polygon) = 'object' AND polygon->>'type' = 'Polygon' THEN polygon::text
            WHEN jsonb_typeof(polygon) = 'object' AND polygon->>'type' = 'Feature' THEN (polygon->>'geometry')::text
            ELSE polygon::text
          END
        ), 4326))) AS lon,
        ST_Y(ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(
          CASE 
            WHEN jsonb_typeof(polygon) = 'object' AND polygon->>'type' = 'Polygon' THEN polygon::text
            WHEN jsonb_typeof(polygon) = 'object' AND polygon->>'type' = 'Feature' THEN (polygon->>'geometry')::text
            ELSE polygon::text
          END
        ), 4326))) AS lat
      FROM zones
      WHERE id = $1;
    `, [targetZone.id]);
    const insideLon = parseFloat(pointRes.rows[0]?.lon || 112.7200);
    const insideLat = parseFloat(pointRes.rows[0]?.lat || -7.4450);

    const checkInRes = await fetch(`${BASE_URL}/api/rider/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({
        assignment_id: assignmentId,
        zone_id: targetZone.id,
        lat: insideLat,
        lon: insideLon,
      }),
    });
    const checkInData = await checkInRes.json();
    assertTest("PostGIS Spatial Check-In Success", checkInRes.status === 200 && checkInData.check_in?.assignment?.status === "CHECKED_IN", `Status: ${checkInData.check_in?.assignment?.status}`);

    // 8. Stage 6: Zone Active Rider Metric Check (Post-Check-In)
    console.log(`\n[8] Verifying Active Rider Metric Post-Check-In (Expected: 1)...`);

    const zonePostCheckRes = await fetch(`${BASE_URL}/api/zones/${targetZone.id}`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const zonePostCheckData = await zonePostCheckRes.json();
    assertTest("Zone Active Riders Count = 1 (Post-Check-In)", zonePostCheckData.zone?.active_riders_count === 1, `Count: ${zonePostCheckData.zone?.active_riders_count}`);

    // 9. Stage 7: Sales Transaction Recording
    console.log(`\n[9] Testing Stage 7: Sales Transaction Recording...`);

    const saleRes = await fetch(`${BASE_URL}/api/rider/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({
        product_id: testProduct.id,
        quantity: 3,
        lat: insideLat,
        lon: insideLon,
      }),
    });
    const saleData = await saleRes.json();
    assertTest("Sales Transaction Logged", saleRes.status === 200 && !!saleData.sales_log?.id, `Sale ID: ${saleData.sales_log?.id}, Qty: ${saleData.sales_log?.qty}`);

    // 10. Stage 8: Checkout Operational Session & Armada Return
    console.log(`\n[10] Testing Stage 8: Checkout Session & Armada Return...`);

    const checkoutRes = await fetch(`${BASE_URL}/api/rider/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderToken}` },
      body: JSON.stringify({
        assignment_id: assignmentId,
        armada_id: testArmada.id,
        return_status: "ACTIVE",
      }),
    });
    const checkoutData = await checkoutRes.json();
    assertTest("Rider Operational Checkout", checkoutRes.status === 200 && checkoutData.checkout?.status === "COMPLETED", `Session Status: ${checkoutData.checkout?.status}`);

    // Verify Armada returned to ACTIVE
    const armadaReturned = await pool.query("SELECT status, current_rider_id FROM armadas WHERE id = $1;", [testArmada.id]);
    assertTest("Armada Returned -> ACTIVE", armadaReturned.rows[0]?.status === "ACTIVE" && armadaReturned.rows[0]?.current_rider_id === null);

    // 11. Stage 9: Zone Active Rider Metric Check (Post-Checkout)
    console.log(`\n[11] Verifying Active Rider Metric Post-Checkout (Expected: 0)...`);

    const zonePostCheckoutRes = await fetch(`${BASE_URL}/api/zones/${targetZone.id}`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const zonePostCheckoutData = await zonePostCheckoutRes.json();
    assertTest("Zone Active Riders Count = 0 (Post-Checkout)", zonePostCheckoutData.zone?.active_riders_count === 0, `Count: ${zonePostCheckoutData.zone?.active_riders_count}`);

    // 12. Stage 10: Ownership-Scoped Duty History (GET /api/distribution/my-history)
    console.log(`\n[12] Testing Stage 10: Ownership-Scoped Duty History...`);

    const historyRes = await fetch(`${BASE_URL}/api/distribution/my-history`, {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const historyData = await historyRes.json();
    const hasTodayRecord = (historyData.history || []).some((h) => h.assignment_id === assignmentId);
    assertTest("Rider 1 Personal Duty History Retrieved", historyRes.status === 200 && hasTodayRecord, `Total records: ${historyData.total_records}`);

    // Verify Rider 2 only sees their own history (isolated)
    const rider2HistoryRes = await fetch(`${BASE_URL}/api/distribution/my-history`, {
      headers: { Authorization: `Bearer ${rider2Token}` },
    });
    const rider2HistoryData = await rider2HistoryRes.json();
    const rider2SeesRider1 = (rider2HistoryData.history || []).some((h) => h.assignment_id === assignmentId);
    assertTest("Rider History Ownership Isolation (Zero Leakage)", !rider2SeesRider1, `Rider 2 Records: ${rider2HistoryData.total_records}`);

    // Clean up temporary test rider
    await pool.query("DELETE FROM users WHERE id = $1;", [rider2User.id]);

  } catch (err) {
    console.error("FATAL ERROR in State Integrity tests:", err);
  } finally {
    if (localServer) {
      localServer.close();
    }
    console.log(`\n======================================================`);
    console.log(`Phase 2: State Integrity Test Results:`);
    console.log(`PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log(`======================================================\n`);
    await pool.end();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runStateIntegrityTests();
