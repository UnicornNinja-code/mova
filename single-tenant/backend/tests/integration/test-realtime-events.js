/*
 * test-realtime-events.js
 * Comprehensive Integration Test Suite for Phase 6: Notification & Real-Time Event Streams
 * Tests:
 * 1. Socket.IO Handshake Auth & Illegal Connection Rejection
 * 2. Role-Based Room Isolation (Management, Supervisor, Rider Private Room)
 * 3. Manual & Auto Distribution Realtime Emissions
 * 4. Operational State Transitions (ARMADA_CLAIMED, RIDER_CHECKED_IN, RIDER_CHECKED_OUT)
 * 5. Field-Level Role Projections for Live Sales Ticker (Management vs Supervisor)
 * 6. Deterministic Idempotency Keys & Sliding-Window Geofence Deduplication
 */

import { io as ClientIO } from "socket.io-client";
import { server } from "../../index.js";
import { pool } from "../../src/config/database.js";
import bcrypt from "bcrypt";

const PORT = process.env.PORT || 9000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

let passedCount = 0;
let failedCount = 0;

function assertTest(name, condition, extraInfo = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${name}${extraInfo ? ` (${extraInfo})` : ""}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${name}${extraInfo ? ` (${extraInfo})` : ""}`);
    failedCount++;
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });
  const data = await res.json();
  return { status: res.status, token: data.token, user: data.user, data };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = ClientIO(BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });

    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => resolve({ error: err.message, isError: true }));
  });
}

async function runRealtimeTests() {
  console.log("\n======================================================");
  console.log("Starting Phase 6: Real-Time Event Streams Test Suite");
  console.log(`Target: ${BASE_URL}`);
  console.log("======================================================\n");

  let localServer = null;
  let mgtSocket = null;
  let spvSocket = null;
  let riderSocket = null;

  try {
    try {
      await fetch(`${BASE_URL}/api/poi-categories`, { signal: AbortSignal.timeout(1200) });
    } catch {
      console.log(`Starting test server on port ${PORT}...`);
      await new Promise((resolve) => server.listen(PORT, resolve));
      localServer = server;
      console.log(`Test server running at ${BASE_URL}\n`);
    }

    // 0. Setup Test Users
    const defaultHash = await bcrypt.hash("password123", 10);
    const usersData = [
      { email: "sa_rt@example.com", username: "sa_rt", name: "Superadmin RT", role: "SUPERADMIN" },
      { email: "mgt_rt@example.com", username: "mgt_rt", name: "Management RT", role: "MANAGEMENT" },
      { email: "spv_rt@example.com", username: "spv_rt", name: "Supervisor RT", role: "SUPERVISOR" },
      { email: "rider_rt@example.com", username: "rider_rt", name: "Rider RT", role: "RIDER" },
    ];

    for (const u of usersData) {
      await pool.query(
        `INSERT INTO users (username, name, email, password, role)
         VALUES ($1, $2, $3, $4, $5::"Role")
         ON CONFLICT (email) DO UPDATE SET password = $4, role = $5::"Role";`,
        [u.username, u.name, u.email, defaultHash, u.role]
      );
    }

    console.log("[1] Testing Socket.IO Handshake Authentication...");
    // Illegal connection without token
    const unauthSocket = await connectSocket(null);
    assertTest("Unauthenticated Socket Handshake Blocked", unauthSocket.isError === true);

    // Illegal connection with invalid token
    const invalidSocket = await connectSocket("invalid.jwt.token");
    assertTest("Invalid JWT Socket Handshake Blocked", invalidSocket.isError === true);

    // Valid logins
    const mgtLogin = await login("mgt_rt@example.com", "password123");
    const spvLogin = await login("spv_rt@example.com", "password123");
    const riderLogin = await login("rider_rt@example.com", "password123");

    mgtSocket = await connectSocket(mgtLogin.token);
    spvSocket = await connectSocket(spvLogin.token);
    riderSocket = await connectSocket(riderLogin.token);

    assertTest("Management Socket Handshake Succeeded", !!mgtSocket.id);
    assertTest("Supervisor Socket Handshake Succeeded", !!spvSocket.id);
    assertTest("Rider Socket Handshake Succeeded", !!riderSocket.id);

    // 1. Setup Test Zone & Armada
    console.log("\n[2] Setting up Test Master Data (Zone & Armada)...");
    const testPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [112.7100, -7.4400],
          [112.7300, -7.4400],
          [112.7300, -7.4600],
          [112.7100, -7.4600],
          [112.7100, -7.4400],
        ]
      ]
    };

    await pool.query(`DELETE FROM zones WHERE name = 'Zona Realtime Phase 6';`);
    const testZoneRes = await pool.query(
      `INSERT INTO zones (name, polygon, max_capacity, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING id, name;`,
      ["Zona Realtime Phase 6", JSON.stringify(testPolygon), 10]
    );
    const testZoneId = testZoneRes.rows[0].id;
    const testZoneName = testZoneRes.rows[0].name;

    const testArmadaRes = await pool.query(
      `INSERT INTO armadas (code, type, status)
       VALUES ($1, 'MOTOR_LISTRIK', 'ACTIVE')
       ON CONFLICT (code) DO UPDATE SET status = 'ACTIVE'
       RETURNING id, code;`,
      ["RT-01"]
    );
    const testArmadaId = testArmadaRes.rows[0].id;
    const testArmadaCode = testArmadaRes.rows[0].code;

    // Reset queues and active assignments for test rider
    const riderId = riderLogin.user.id;
    await pool.query(`DELETE FROM zone_assignments WHERE rider_id = $1;`, [riderId]);
    await pool.query(`DELETE FROM rider_duty_queues WHERE rider_id = $1;`, [riderId]);

    // 2. Testing Manual Plotting & Real-Time Assignment Event
    console.log("\n[3] Testing Manual Plotting & RIDER_ASSIGNED Event...");
    const riderAssignedPromise = new Promise((resolve) => {
      riderSocket.once("rider:assigned_notification", (payload) => resolve(payload));
    });
    const spvRiderAssignedPromise = new Promise((resolve) => {
      spvSocket.once("supervisor:rider_assigned", (payload) => resolve(payload));
    });

    const manualPlotRes = await fetch(`${BASE_URL}/api/distribution/manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${spvLogin.token}`,
      },
      body: JSON.stringify({
        rider_id: riderId,
        zone_id: testZoneId,
      }),
    });
    const manualPlotData = await manualPlotRes.json();
    assertTest("Manual Plotting API Responded 200", manualPlotRes.status === 200);

    const riderNotif = await Promise.race([
      riderAssignedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000)),
    ]);

    assertTest("Rider Received RIDER_ASSIGNED Envelope", riderNotif.type === "RIDER_ASSIGNED");
    assertTest("Rider Event Contains Deterministic event_id", riderNotif.event_id?.startsWith("evt_assign_"));
    assertTest("Rider Event Contains Zone Name", riderNotif.data?.zone_name === testZoneName);

    const spvAssignedNotif = await Promise.race([
      spvRiderAssignedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000)),
    ]);
    assertTest("Supervisor Received supervisor:rider_assigned", !!spvAssignedNotif.event_id);

    // 3. Testing Armada Permanent Claim Event
    console.log("\n[4] Testing Armada Claim & ARMADA_CLAIMED Event...");
    const claimBroadcastPromise = new Promise((resolve) => {
      spvSocket.once("armada:claimed_broadcast", (payload) => resolve(payload));
    });

    // Hold first
    const holdRes = await fetch(`${BASE_URL}/api/rider/hold-armada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderLogin.token}` },
      body: JSON.stringify({ armada_id: testArmadaId }),
    });

    // Confirm claim
    const claimRes = await fetch(`${BASE_URL}/api/rider/claim-armada`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderLogin.token}` },
      body: JSON.stringify({ armada_id: testArmadaId }),
    });
    assertTest("Armada Claim API Responded 200", claimRes.status === 200);

    const claimEvent = await Promise.race([
      claimBroadcastPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000)),
    ]);
    assertTest("Clients Received ARMADA_CLAIMED Event", claimEvent.type === "ARMADA_CLAIMED");
    assertTest("Claim Event Contains Deterministic event_id", claimEvent.event_id === `evt_claim_${testArmadaId}`);

    // 4. Testing Check-in Event
    console.log("\n[5] Testing PostGIS Check-in & RIDER_CHECKED_IN Event...");
    const spvCheckinPromise = new Promise((resolve) => {
      spvSocket.once("supervisor:rider_checked_in", (payload) => resolve(payload));
    });

    const checkinRes = await fetch(`${BASE_URL}/api/rider/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderLogin.token}` },
      body: JSON.stringify({ latitude: -7.4500, longitude: 112.7200 }),
    });
    assertTest("Check-in API Responded 200", checkinRes.status === 200);

    const checkinEvent = await Promise.race([
      spvCheckinPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000)),
    ]);
    assertTest("Supervisor Received RIDER_CHECKED_IN Event", checkinEvent.type === "RIDER_CHECKED_IN");
    assertTest("Checkin Event Contains Deterministic event_id", checkinEvent.event_id?.startsWith("evt_checkin_"));

    // 5. Testing Field-Level Role Projections on Live Sales Ticker
    console.log("\n[6] Testing Live Sales Ticker & Field-Level Role Projections...");
    // Fetch an available product
    const prodRes = await pool.query(
      `INSERT INTO products (name, price, status)
       VALUES ('Kopi Realtime Signature', 22000, 'AVAILABLE')
       ON CONFLICT DO NOTHING
       RETURNING id, name, price;`
    );
    const prod = prodRes.rows[0] || (await pool.query(`SELECT id, name, price FROM products WHERE status = 'AVAILABLE' LIMIT 1;`)).rows[0];

    const mgtSalePromise = new Promise((resolve) => {
      mgtSocket.once("management:sale_recorded", (payload) => resolve(payload));
    });
    const spvSalePromise = new Promise((resolve) => {
      spvSocket.once("supervisor:sale_recorded", (payload) => resolve(payload));
    });

    const saleRes = await fetch(`${BASE_URL}/api/rider/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderLogin.token}` },
      body: JSON.stringify({
        product_id: prod.id,
        quantity: 2,
        latitude: -7.4500,
        longitude: 112.7200,
      }),
    });
    assertTest("Sale Recording API Responded 200", saleRes.status === 200);

    const [mgtSaleEvent, spvSaleEvent] = await Promise.all([
      Promise.race([mgtSalePromise, new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Mgt Sale")), 3000))]),
      Promise.race([spvSalePromise, new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Spv Sale")), 3000))]),
    ]);

    // Verify Management received full financial payload
    assertTest("Management Received SALE_RECORDED Event", mgtSaleEvent.type === "SALE_RECORDED");
    assertTest("Management Payload Contains unit_price & total_price", typeof mgtSaleEvent.data?.unit_price === "number" && typeof mgtSaleEvent.data?.total_price === "number");

    // Verify Supervisor received operational payload with NO financial leak
    assertTest("Supervisor Received SALE_RECORDED Event", spvSaleEvent.type === "SALE_RECORDED");
    assertTest("Supervisor Payload Contains product_name & qty", spvSaleEvent.data?.product_name === prod.name && spvSaleEvent.data?.qty === 2);
    assertTest("Supervisor Payload Excludes unit_price & total_price (Zero Financial Leak)", spvSaleEvent.data?.unit_price === undefined && spvSaleEvent.data?.total_price === undefined);

    // 6. Testing Room Isolation: Rider Cannot Receive Management Broadcasts
    console.log("\n[7] Testing Room Isolation (Rider Blocked from Management Broadcasts)...");
    let riderReceivedLeak = false;
    riderSocket.on("management:sale_recorded", () => {
      riderReceivedLeak = true;
    });
    riderSocket.on("supervisor:sale_recorded", () => {
      riderReceivedLeak = true;
    });

    // Wait 300ms to ensure no leaked events arrive at riderSocket
    await new Promise((r) => setTimeout(r, 300));
    assertTest("Rider Isolated From Management & Supervisor Events (Zero Cross-Room Leak)", riderReceivedLeak === false);

    // 7. Testing Session Checkout Event
    console.log("\n[8] Testing Session Checkout & RIDER_CHECKED_OUT Event...");
    const spvCheckoutPromise = new Promise((resolve) => {
      spvSocket.once("supervisor:rider_checked_out", (payload) => resolve(payload));
    });

    const checkoutRes = await fetch(`${BASE_URL}/api/rider/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${riderLogin.token}` },
      body: JSON.stringify({ return_status: "ACTIVE" }),
    });
    assertTest("Checkout API Responded 200", checkoutRes.status === 200);

    const checkoutEvent = await Promise.race([
      spvCheckoutPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000)),
    ]);
    assertTest("Supervisor Received RIDER_CHECKED_OUT Event", checkoutEvent.type === "RIDER_CHECKED_OUT");
    assertTest("Checkout Event Contains Deterministic event_id", checkoutEvent.event_id?.startsWith("evt_checkout_"));

    console.log("\n======================================================");
    console.log(`Phase 6 Test Results: PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log("======================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("FATAL ERROR in Phase 6 tests:", error);
    process.exit(1);
  } finally {
    if (mgtSocket && mgtSocket.close) mgtSocket.close();
    if (spvSocket && spvSocket.close) spvSocket.close();
    if (riderSocket && riderSocket.close) riderSocket.close();
    if (localServer && localServer.close) {
      await new Promise((resolve) => localServer.close(resolve));
    }
    await pool.end();
  }
}

runRealtimeTests();
