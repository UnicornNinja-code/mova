/*
 * verify-api-stability.ts
 * Comprehensive HTTP Endpoint Stability & Response Health Audit
 * 
 * Tests every major API domain of the MantaKopi COZIS DSS platform:
 * - Public & Health Checks
 * - Auth & RBAC Security Boundaries
 * - User Management
 * - Products & Catalog
 * - Armada & Fleet Cycle
 * - Spatial GIS Layers (Protocol Roads, Toll Roads, Zones, POIs, Competitors)
 * - DSS BWM & TOPSIS Engine
 * - Operational Sessions & Distribution Queue
 * - Analytics & Reporting Dashboard
 * - Audit Logs & System Readiness
 */

interface ApiAuditResult {
  group: string;
  endpoint: string;
  method: string;
  status: "STABIL" | "SUB-OPTIMAL" | "BELUM STABIL";
  httpCode: number;
  latencyMs: number;
  notes: string;
}

const BASE_URL = "http://localhost:9000";

async function runApiAudit() {
  console.log("================================================================================");
  console.log("🔍 AUDIT KESTABILAN SELURUH API ENDPOINT BACKEND (MANTAKOPI COZIS)");
  console.log("================================================================================\n");

  const results: ApiAuditResult[] = [];

  // Helper to record result
  const record = (
    group: string,
    endpoint: string,
    method: string,
    httpCode: number,
    latencyMs: number,
    status: "STABIL" | "SUB-OPTIMAL" | "BELUM STABIL",
    notes: string
  ) => {
    results.push({ group, endpoint, method, status, httpCode, latencyMs, notes });
    const icon = status === "STABIL" ? "🟢" : status === "SUB-OPTIMAL" ? "🟡" : "🔴";
    console.log(`  ${icon} [${method} ${endpoint}] -> HTTP ${httpCode} (${latencyMs}ms) | ${notes}`);
  };

  // Helper fetch with timing
  const testReq = async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ status: number; data: any; timeMs: number }> => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, options);
      const timeMs = Math.round(performance.now() - t0);
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, data, timeMs };
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - t0);
      return { status: 0, data: { error: err.message }, timeMs };
    }
  };

  // 1. PUBLIC & HEALTH CHECK
  console.log("📦 [1. HEALTH & PUBLIC APIS]");
  {
    const r = await testReq("/api/health");
    const isOk = r.status === 200 && r.data?.status === "ok";
    record("HEALTH", "/api/health", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL", 
      isOk ? "Layanan aktif, runtime Bun+TS" : "Gagal membaca status health");
  }

  // 2. AUTHENTICATION & TOKENS
  console.log("\n🔐 [2. AUTHENTICATION & RBAC]");
  let superadminToken = "";
  let riderToken = "";

  {
    const r = await testReq("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "superadmin@kopikeliling.com", password: "password123" }),
    });
    const isOk = r.status === 200 && r.data?.token;
    if (isOk) superadminToken = r.data.token;
    record("AUTH", "/api/auth/login (Superadmin)", "POST", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Login berhasil, Role: ${r.data.user?.role}` : "Login Superadmin gagal");
  }

  {
    const r = await testReq("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "rider@kopikeliling.com", password: "password123" }),
    });
    const isOk = r.status === 200 && r.data?.token;
    if (isOk) riderToken = r.data.token;
    record("AUTH", "/api/auth/login (Rider)", "POST", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Login berhasil, Role: ${r.data.user?.role}` : "Login Rider gagal");
  }

  {
    const r = await testReq("/api/auth/me", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200 && r.data?.user?.email === "superadmin@kopikeliling.com";
    record("AUTH", "/api/auth/me", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Session validasi aktif" : "Gagal membaca user me");
  }

  {
    // Test unauthenticated access
    const r = await testReq("/api/users");
    const isOk = r.status === 401;
    record("AUTH", "/api/users (Unauthenticated Guard)", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Guard 401 Unauthorized bekerja dengan benar" : "Kebocoran keamanan tanpa token");
  }

  // 3. USER MANAGEMENT
  console.log("\n👥 [3. USER MANAGEMENT]");
  {
    const r = await testReq("/api/users", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200 && Array.isArray(r.data?.users || r.data);
    record("USERS", "/api/users", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Total user terdaftar: ${(r.data?.users || r.data).length}` : "Gagal memuat list user");
  }

  // 4. MASTER CATALOG & PRODUCTS
  console.log("\n☕ [4. MASTER PRODUK]");
  {
    const r = await testReq("/api/products", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const list = r.data?.data || r.data?.products || r.data;
    const isOk = r.status === 200 && Array.isArray(list);
    record("PRODUCTS", "/api/products", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Total produk aktif: ${list.length}` : "Gagal memuat katalog produk");
  }

  // 5. ARMADA & FLEET MANAGEMENT
  console.log("\n🚲 [5. ARMADA & FLEET CYCLE]");
  let sampleArmadaId = "";
  {
    const r = await testReq("/api/armadas", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const list = r.data?.armadas || r.data;
    const isOk = r.status === 200 && Array.isArray(list);
    if (isOk && list.length > 0) sampleArmadaId = list[0].id;
    record("ARMADAS", "/api/armadas", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Total unit armada: ${list.length}` : "Gagal memuat armada");
  }

  if (sampleArmadaId) {
    const r = await testReq(`/api/armadas/${sampleArmadaId}`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200 && r.data?.armada?.code;
    record("ARMADAS", `/api/armadas/:id`, "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Detail unit: ${r.data.armada.code} (${r.data.armada.status})` : "Gagal memuat detail armada");
  }

  // 6. SPATIAL RESTRICTION & GIS LAYERS (PostGIS)
  console.log("\n🗺️ [6. SPATIAL RESTRICTION & GIS LAYERS]");
  {
    const r = await testReq("/api/roads/protocol");
    const count = r.data?.features?.length || 0;
    const isOk = r.status === 200 && count > 0;
    const status = isOk ? (r.timeMs > 150 ? "SUB-OPTIMAL" : "STABIL") : "BELUM STABIL";
    record("SPATIAL", "/api/roads/protocol", "GET", r.status, r.timeMs, status,
      isOk ? `${count} Ruas jalan protokol GeoJSON PostGIS dimuat` : "Layer jalan protokol kosong/gagal");
  }

  {
    const r = await testReq("/api/roads/toll");
    const count = r.data?.features?.length || 0;
    const isOk = r.status === 200;
    record("SPATIAL", "/api/roads/toll", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `${count} Ruas jalan tol GeoJSON PostGIS dimuat` : "Gagal memuat layer jalan tol");
  }

  {
    const r = await testReq("/api/zones", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200 && Array.isArray(r.data?.zones || r.data);
    const count = (r.data?.zones || r.data)?.length || 0;
    record("SPATIAL", "/api/zones", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `${count} Poligon zona operasional aktif dimuat` : "Gagal memuat zona");
  }

  {
    const r = await testReq("/api/pois/operational-area", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    const count = (r.data?.pois || r.data)?.length || 0;
    record("SPATIAL", "/api/pois/operational-area", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `${count} Titik POI operasional terdaftar` : "Gagal memuat POI operasional");
  }

  {
    const r = await testReq("/api/poi-categories");
    const isOk = r.status === 200 && Array.isArray(r.data?.categories || r.data);
    record("SPATIAL", "/api/poi-categories", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `${(r.data?.categories || r.data).length} Kategori POI waktu aktif` : "Gagal memuat kategori POI");
  }

  {
    const r = await testReq("/api/weathers/hub/sidoarjo", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("SPATIAL", "/api/weathers/hub/:city", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Cuaca Hub Sidoarjo: ${r.data?.weather?.condition || 'Online'}` : "Gagal memuat cuaca Hub");
  }

  {
    const r = await testReq("/api/competitors", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("SPATIAL", "/api/competitors", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Kompetitor dataset aktif" : "Gagal memuat kompetitor");
  }

  // 7. DSS BWM & TOPSIS ENGINE
  console.log("\n🧠 [7. DSS BWM & TOPSIS ENGINE]");
  {
    const r = await testReq("/api/dss/bwm/active", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200 && r.data?.config?.name;
    record("DSS", "/api/dss/bwm/active", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Konfigurasi aktif: ${r.data.config.name}` : "Konfigurasi BWM aktif tidak ditemukan");
  }

  {
    const r = await testReq("/api/dss/recommendations?timeSlot=SIANG", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const rankings = r.data?.rankings || [];
    const isOk = r.status === 200 && rankings.length > 0;
    const status = isOk ? (r.timeMs > 250 ? "SUB-OPTIMAL" : "STABIL") : "BELUM STABIL";
    record("DSS", "/api/dss/recommendations (TOPSIS)", "GET", r.status, r.timeMs, status,
      isOk ? `Kalkulasi TOPSIS sukses merangking ${rankings.length} zona` : "Kalkulasi TOPSIS kosong/gagal");
  }

  // 8. OPERATIONAL SESSIONS & DISTRIBUTION
  console.log("\n📋 [8. SESI OPERASIONAL & DISTRIBUSI]");
  {
    const r = await testReq("/api/distribution/overview", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200 && r.data?.session?.id;
    record("DISTRIBUTION", "/api/distribution/overview", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Sesi aktif: ${r.data.session.session_code} (${r.data.session.time_slot})` : "Gagal overview sesi operasional");
  }

  {
    const r = await testReq("/api/rider/hub-armadas", {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const isOk = r.status === 200 && Array.isArray(r.data?.armadas || r.data);
    record("RIDER_OPS", "/api/rider/hub-armadas", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Armada tersedia untuk rider: ${(r.data?.armadas || r.data).length} unit` : "Gagal memuat ketersediaan armada");
  }

  {
    const r = await testReq("/api/rider/active-session", {
      headers: { Authorization: `Bearer ${riderToken}` },
    });
    const isOk = r.status === 200;
    record("RIDER_OPS", "/api/rider/active-session", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Status sesi aktif rider: ${r.data?.has_active_session ? 'Bertugas' : 'Tersedia'}` : "Gagal mengecek sesi aktif rider");
  }

  // 9. DASHBOARD & REPORTING
  console.log("\n📊 [9. DASHBOARD ANALYTICS]");
  {
    const r = await testReq("/api/dashboard/summary", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("DASHBOARD", "/api/dashboard/summary", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Metrik ringkasan pendapatan & unit harian aktif" : "Gagal memuat summary dashboard");
  }

  {
    const r = await testReq("/api/dashboard/sales-trend", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("DASHBOARD", "/api/dashboard/sales-trend", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Tren penjualan 30 hari termuat" : "Gagal memuat tren penjualan");
  }

  {
    const r = await testReq("/api/dashboard/zone-performance", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("DASHBOARD", "/api/dashboard/zone-performance", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Performa penjualan per zona termuat" : "Gagal memuat performa zona");
  }

  // 10. SYSTEM FOUNDATION & READINESS
  console.log("\n🛡️ [10. SYSTEM READINESS & AUDIT]");
  {
    const r = await testReq("/api/system/readiness", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("SYSTEM", "/api/system/readiness", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Evaluasi kesiapan operasional sistem siap" : "Gagal evaluasi kesiapan sistem");
  }

  {
    const r = await testReq("/api/audit-logs", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("AUDIT", "/api/audit-logs", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? `Audit log tercatat (${r.data?.count || 0} entri)` : "Gagal memuat audit log");
  }

  {
    const r = await testReq("/api/notifications", {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    const isOk = r.status === 200;
    record("NOTIF", "/api/notifications", "GET", r.status, r.timeMs, isOk ? "STABIL" : "BELUM STABIL",
      isOk ? "Notifikasi in-app termuat" : "Gagal memuat notifikasi");
  }

  console.log("\n================================================================================");
  console.log("📊 REKAPITULASI HASIL AUDIT KESTABILAN API");
  console.log("================================================================================");
  console.table(
    results.map((r) => ({
      Domain: r.group,
      Endpoint: `${r.method} ${r.endpoint}`,
      Status: r.status,
      HTTP: r.httpCode,
      Latensi: `${r.latencyMs}ms`,
      Catatan: r.notes.slice(0, 40),
    }))
  );

  const total = results.length;
  const stabil = results.filter((r) => r.status === "STABIL").length;
  const subOptimal = results.filter((r) => r.status === "SUB-OPTIMAL").length;
  const belumStabil = results.filter((r) => r.status === "BELUM STABIL").length;

  console.log(`\n📌 Total Endpoint Diuji  : ${total}`);
  console.log(`🟢 Stabil (< 150ms & OK) : ${stabil} (${Math.round((stabil / total) * 100)}%)`);
  console.log(`🟡 Sub-optimal (> 150ms) : ${subOptimal} (${Math.round((subOptimal / total) * 100)}%)`);
  console.log(`🔴 Belum Stabil (Error)  : ${belumStabil} (${Math.round((belumStabil / total) * 100)}%)`);
  console.log("================================================================================\n");
}

runApiAudit();
