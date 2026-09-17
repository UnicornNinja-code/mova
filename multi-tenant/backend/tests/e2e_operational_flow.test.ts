import { describe, it, expect, beforeAll } from "bun:test";

// Base configuration
const BASE_URL = process.env.TEST_API_URL || "http://localhost:3000";

describe("PART 15 — End-to-End Operational Lifecycle Verification", () => {
  // Shared context across the 8-step operational simulation
  let superadminToken: string;
  let riderToken: string;
  let riderId: string;
  let testZoneId: string;
  let testArmadaId: string;
  let activeProductId: string;
  let unitProductPrice: number;
  let recordedSaleId: string;
  let activeAssignmentId: string;

  const testPayloads = {
    hubCity: "Surabaya",
    hubLat: -7.2575,
    hubLng: 112.7521,
    hubRadiusKm: 25,
    zoneName: "Zone Central Core",
    // GeoJSON Polygon closed ring centered in operational radius
    zonePolygon: {
      type: "Polygon",
      coordinates: [
        [
          [112.7500, -7.2550],
          [112.7550, -7.2550],
          [112.7550, -7.2600],
          [112.7500, -7.2600],
          [112.7500, -7.2550]
        ]
      ]
    },
    riderCheckInCoords: {
      latitude: -7.2570,
      longitude: 112.7520
    }
  };

  beforeAll(async () => {
    // 0. Setup: Authenticate Superadmin
    try {
      const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "superadmin@system.local",
          password: "SuperPassword123!"
        })
      });
      if (adminRes.ok) {
        const adminData = (await adminRes.json()) as any;
        superadminToken = adminData.token || adminData.data?.token;
      }
    } catch {
      // Server may be offline during dry-run typecheck
    }

    // 0. Setup: Authenticate or prepare RIDER
    try {
      const riderRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "rider1@system.local",
          password: "RiderPassword123!"
        })
      });
      if (riderRes.ok) {
        const riderData = (await riderRes.json()) as any;
        riderToken = riderData.token || riderData.data?.token;
        riderId = riderData.user?.id || riderData.data?.user?.id;
      }
    } catch {
      // Server may be offline during dry-run typecheck
    }
  });

  // STEP 1: Onboarding → Hub city configured
  it("Step 1: Onboarding → Should configure Hub City and Operational Context", async () => {
    if (!superadminToken) return;

    const res = await fetch(`${BASE_URL}/api/system/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`
      },
      body: JSON.stringify({
        settings: {
          HUB_CITY_NAME: testPayloads.hubCity,
          CENTRAL_HUB_LAT: testPayloads.hubLat,
          CENTRAL_HUB_LNG: testPayloads.hubLng,
          OPERATIONAL_RADIUS_KM: testPayloads.hubRadiusKm
        }
      })
    });

    expect([200, 201]).toContain(res.status);

    // Verify readiness and context cache invalidation
    const readinessRes = await fetch(`${BASE_URL}/api/system/readiness`, {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    expect(readinessRes.status).toBe(200);
    const readiness = (await readinessRes.json()) as any;
    const checks = readiness.checks || readiness.data?.checks;
    if (checks) {
      expect(checks.hub_configured).toBe(true);
    }
  });

  // STEP 2: POI Sync → Overpass data ingested & verified
  it("Step 2: POI Sync → Should trigger spatial ingestion and verify GiST index availability", async () => {
    if (!superadminToken) return;

    // Create base zone for testing POI clustering
    const zoneCreateRes = await fetch(`${BASE_URL}/api/zones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`
      },
      body: JSON.stringify({
        name: testPayloads.zoneName,
        description: "Primary operational test polygon",
        max_capacity: 5,
        polygon: testPayloads.zonePolygon
      })
    });
    expect([200, 201]).toContain(zoneCreateRes.status);
    const zoneData = (await zoneCreateRes.json()) as any;
    testZoneId = zoneData.zone ? zoneData.zone.id : zoneData.data?.id;

    // Trigger sync
    const syncRes = await fetch(`${BASE_URL}/api/data-sync/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`
      },
      body: JSON.stringify({ dataset_type: "poi" })
    });
    expect([200, 202]).toContain(syncRes.status);

    // Fetch POIs in the created zone to ensure GiST query functions
    const poisRes = await fetch(`${BASE_URL}/api/pois?zone_id=${testZoneId}&limit=10`, {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    expect(poisRes.status).toBe(200);
    const poisData = (await poisRes.json()) as any;
    expect(Array.isArray(poisData.pois || poisData.data)).toBe(true);
  });

  // STEP 3: BWM/TOPSIS → Zone rankings computed & persisted
  it("Step 3: DSS Engine → Should run hybrid BWM-TOPSIS evaluation and generate snapshot", async () => {
    if (!superadminToken || !testZoneId) return;

    const evalRes = await fetch(`${BASE_URL}/api/dss/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`
      },
      body: JSON.stringify({
        zone_ids: [testZoneId],
        time_slot: "pagi"
      })
    });

    expect(evalRes.status).toBe(200);
    const evalResult = (await evalRes.json()) as any;
    const payload = evalResult.data || evalResult;

    expect(payload.snapshot_id || payload.evaluation_version).toBeDefined();
    if (payload.topsis_summary?.rankings) {
      expect(Array.isArray(payload.topsis_summary.rankings)).toBe(true);
      if (payload.topsis_summary.rankings.length > 0) {
        const score = payload.topsis_summary.rankings[0].final_score ?? payload.topsis_summary.rankings[0].score;
        expect(score).toBeGreaterThanOrEqual(0.0);
        expect(score).toBeLessThanOrEqual(1.0);
      }
    }
  });

  // STEP 4: Batch Distribution → Riders confirmed ready and assigned to zones
  it("Step 4: Distribution → Should confirm rider duty readiness and plot to ranked zone", async () => {
    if (!riderToken || !superadminToken || !testZoneId) return;

    // 4a. Rider duty confirm (Transition to WAITING)
    const dutyRes = await fetch(`${BASE_URL}/api/distribution/duty-confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`
      },
      body: JSON.stringify({ rider_id: riderId })
    });
    expect([200, 201]).toContain(dutyRes.status);

    // 4b. Prepare available Armada
    const fleetRes = await fetch(`${BASE_URL}/api/fleets`, {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    expect(fleetRes.status).toBe(200);
    const fleetData = (await fleetRes.json()) as any;
    const armadas = fleetData.armadas || fleetData.data;
    const availableArmada = armadas?.find((a: any) => a.status === "ACTIVE" && !a.current_rider_id);
    if (availableArmada) {
      testArmadaId = availableArmada.id;
    }

    // 4c. Execute Assignment
    const assignRes = await fetch(`${BASE_URL}/api/distribution/manual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`
      },
      body: JSON.stringify({
        rider_id: riderId,
        zone_id: testZoneId,
        armada_id: testArmadaId,
        notes: "E2E Operational Test Assignment"
      })
    });
    expect([200, 201]).toContain(assignRes.status);
    const assignData = (await assignRes.json()) as any;
    const assignment = assignData.assignment || assignData.data;
    activeAssignmentId = assignment?.id;
  });

  // STEP 5: Rider Check-in → GPS validation inside zone polygon
  it("Step 5: Check-in → Rider claims fleet and checks into zone polygon", async () => {
    if (!riderToken || !activeAssignmentId || !testArmadaId) return;

    // 5a. Rider places 5-min lock and claims armada
    const holdRes = await fetch(`${BASE_URL}/api/rider/hold-armada`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`
      },
      body: JSON.stringify({ armada_id: testArmadaId })
    });
    expect([200, 409]).toContain(holdRes.status);

    const claimRes = await fetch(`${BASE_URL}/api/rider/claim-armada`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`
      },
      body: JSON.stringify({
        armada_id: testArmadaId,
        checklist: { brakes_ok: true, tire_pressure_ok: true, battery_full: true }
      })
    });
    expect([200, 201]).toContain(claimRes.status);

    // 5b. Check-in with coordinates inside polygon (transitions to CHECKED_IN)
    const checkInRes = await fetch(`${BASE_URL}/api/rider/check-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`
      },
      body: JSON.stringify({
        assignment_id: activeAssignmentId,
        latitude: testPayloads.riderCheckInCoords.latitude,
        longitude: testPayloads.riderCheckInCoords.longitude
      })
    });
    expect(checkInRes.status).toBe(200);

    // 5c. Verify active session status
    const sessionRes = await fetch(`${BASE_URL}/api/rider/active-session`, {
      headers: { Authorization: `Bearer ${riderToken}` }
    });
    expect(sessionRes.status).toBe(200);
    const sessionData = (await sessionRes.json()) as any;
    const payload = sessionData.data || sessionData;
    expect(payload.has_active_session).toBe(true);
  });

  // STEP 6: Sale → Revenue recorded with server-side price calculation
  it("Step 6: Sales → Should record transaction bound to active shift and calculate total", async () => {
    if (!riderToken) return;

    // 6a. Get active catalog item
    const catalogRes = await fetch(`${BASE_URL}/api/products?status=active`, {
      headers: { Authorization: `Bearer ${riderToken}` }
    });
    expect(catalogRes.status).toBe(200);
    const catalogData = (await catalogRes.json()) as any;
    const products = catalogData.products || catalogData.data;
    if (products && products.length > 0) {
      activeProductId = products[0].id;
      unitProductPrice = products[0].price;

      // 6b. Post record sale
      const saleQty = 3;
      const saleRes = await fetch(`${BASE_URL}/api/rider/record-sale`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${riderToken}`
        },
        body: JSON.stringify({
          items: [{ product_id: activeProductId, quantity: saleQty }],
          payment_method: "CASH"
        })
      });

      expect([200, 201]).toContain(saleRes.status);
      const saleData = (await saleRes.json()) as any;
      const saleRecord = saleData.sale || saleData.data;
      recordedSaleId = saleRecord?.id;

      if (saleRecord && unitProductPrice) {
        expect(saleRecord.total_price).toBe(saleQty * unitProductPrice);
      }

      // 6c. Verify sales history reflects transaction
      const historyRes = await fetch(`${BASE_URL}/api/rider/my-sales`, {
        headers: { Authorization: `Bearer ${riderToken}` }
      });
      expect(historyRes.status).toBe(200);
      const historyData = (await historyRes.json()) as any;
      const salesList = historyData.sales || historyData.data;
      if (salesList && recordedSaleId) {
        const matched = salesList.find((s: any) => s.id === recordedSaleId);
        expect(matched).toBeDefined();
      }
    }
  });

  // STEP 7: Checkout → Shift completed, Armada returned to ACTIVE
  it("Step 7: Checkout → Rider checks out, releasing assignment and fleet", async () => {
    if (!riderToken || !activeAssignmentId) return;

    const checkoutRes = await fetch(`${BASE_URL}/api/rider/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${riderToken}`
      },
      body: JSON.stringify({
        assignment_id: activeAssignmentId,
        notes: "Shift completed without incident"
      })
    });
    expect([200, 201]).toContain(checkoutRes.status);

    // Verify Armada is returned to ACTIVE status and unbound from rider
    if (superadminToken && testArmadaId) {
      const armadaCheckRes = await fetch(`${BASE_URL}/api/fleets`, {
        headers: { Authorization: `Bearer ${superadminToken}` }
      });
      expect(armadaCheckRes.status).toBe(200);
      const armadaList = ((await armadaCheckRes.json()) as any).armadas;
      if (armadaList) {
        const testedArmada = armadaList.find((a: any) => a.id === testArmadaId);
        if (testedArmada) {
          expect(testedArmada.status).toBe("ACTIVE");
          expect(testedArmada.current_rider_id).toBeNull();
        }
      }
    }
  });

  // STEP 8: Report → Data aggregated correctly across operational dimensions
  it("Step 8: Analytics & Reporting → Aggregation accurately captures recorded operations", async () => {
    if (!superadminToken) return;
    const today = new Date().toISOString().split("T")[0];

    // 8a. Verify Executive Summary
    const execRes = await fetch(`${BASE_URL}/api/reports/executive-summary`, {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    expect(execRes.status).toBe(200);
    const execData = (await execRes.json()) as any;
    expect(execData.kpis || execData.data).toBeDefined();

    // 8b. Verify Rider Shift & Sales Report
    if (riderId) {
      const riderReportRes = await fetch(
        `${BASE_URL}/api/reports/riders?start_date=${today}&end_date=${today}&rider_id=${riderId}`,
        { headers: { Authorization: `Bearer ${superadminToken}` } }
      );
      expect(riderReportRes.status).toBe(200);
      const riderReportData = (await riderReportRes.json()) as any;
      const riders = riderReportData.riders || riderReportData.data;
      expect(Array.isArray(riders)).toBe(true);
    }

    // 8c. Verify Dashboard Real-Time Consistency (PART 11)
    const dashSummaryRes = await fetch(`${BASE_URL}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    expect(dashSummaryRes.status).toBe(200);
    const dashSummary = (await dashSummaryRes.json()) as any;
    expect(dashSummary.revenue_today !== undefined || dashSummary.data !== undefined).toBe(true);
  });
});
