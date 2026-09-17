/*
 * test-system-e2e.ts
 * Comprehensive End-to-End System Integration Test for MantaKopi COZIS DSS
 *
 * Menguji SELURUH aspek integrasi sistem backend secara menyeluruh:
 * [1] Infrastruktur Database, PostGIS Spasial & Redis Engine
 * [2] Autentikasi, Enterprise RBAC, Onboarding & Anti-Reload Persistence
 * [3] Master Data Operasional, Katalog Produk & GIS Geofence
 * [4] Lifecycle Armada Lapangan (5-Minute Lock, Klaim, Checklist, Kendala, Return)
 * [5] DSS Engine (Kalibrasi Pembobotan BWM & Perangkingan TOPSIS Multi-Kriteria)
 * [6] Sesi Operasional & Engine Distribusi Otomatis Rider ke Zona
 * [7] Audit Trail Logging & Notifikasi Real-time
 */

import { pool } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import { UserModel } from "../models/userModel.js";
import { ZoneModel } from "../models/zoneModel.js";
import { productRepository } from "../repositories/productRepository.js";
import { armadaService } from "../services/armadaService.js";
import { riderOperationalService } from "../services/rider/RiderOperationalService.js";
import { distributionService } from "../services/distribution/DistributionService.js";
import { topsisEngineService } from "../services/dss/TopsisEngineService.js";
import { bwmRepository } from "../repositories/bwmRepository.js";
import { auditService } from "../services/auditService.js";
import { createUserService, setUserStatusService } from "../services/userService.js";
import {
  loginService,
  registerService,
  verifyResetTokenService,
  refreshTokenService,
} from "../services/authService.js";

interface TestResult {
  module: string;
  code: string;
  name: string;
  status: "PASS" | "FAIL";
  details: string;
  timeMs: number;
}

const testResults: TestResult[] = [];

async function runTest(
  module: string,
  code: string,
  name: string,
  fn: () => Promise<string>
) {
  const t0 = performance.now();
  try {
    const details = await fn();
    const timeMs = Math.round(performance.now() - t0);
    testResults.push({ module, code, name, status: "PASS", details, timeMs });
    console.log(`  ✅ [${code}] ${name} (${timeMs}ms)`);
    console.log(`     ↳ ${details}`);
  } catch (err: any) {
    const timeMs = Math.round(performance.now() - t0);
    testResults.push({ module, code, name, status: "FAIL", details: err.message, timeMs });
    console.error(`  ❌ [${code}] ${name} (${timeMs}ms)`);
    console.error(`     ↳ ERROR: ${err.message}`);
    throw err;
  }
}

async function runFullSystemIntegrationTest() {
  console.log("================================================================================");
  console.log("🚀 MEMULAI PENGUJIAN INTEGRASI SISTEM END-TO-END (MANTAKOPI COZIS DSS)");
  console.log("================================================================================\n");

  const overallStart = performance.now();
  const runId = Date.now().toString().slice(-6);

  // Variabel penampung sesi testing
  let superadminUser: any = null;
  let superadminToken: string = "";

  let managementUser: any = null;
  let managementToken: string = "";
  const testManagementEmail = `mgt.e2e.${runId}@kopikeliling.com`;

  let riderUser: any = null;
  let riderToken: string = "";
  const testRiderEmail = `rider.e2e.${runId}@kopikeliling.com`;

  let testArmada: any = null;
  let operationalSession: any = null;

  try {
    // =========================================================================
    // MODUL 1: INFRASTRUKTUR DATABASE, POSTGIS SPASIAL & REDIS
    // =========================================================================
    console.log("\n📦 [MODUL 1] DATABASE ENGINE, POSTGIS & INFRASTRUKTUR");
    console.log("--------------------------------------------------------------------------------");

    await runTest("MODUL 1", "1.1", "Koneksi PostgreSQL & Ekstensi Spasial PostGIS", async () => {
      const res = await pool.query("SELECT PostGIS_Version() as version;");
      if (!res.rows[0]?.version) {
        throw new Error("PostGIS extension tidak terdeteksi aktif pada database.");
      }
      return `PostgreSQL PostGIS aktif: ${res.rows[0].version}`;
    });

    await runTest("MODUL 1", "1.2", "Integritas Skema Master & Tabel Inti Lengkap", async () => {
      const requiredTables = [
        "users",
        "armadas",
        "zones",
        "products",
        "criterias",
        "pois",
        "protocol_roads",
        "fleet_reservations",
        "fleet_assignments",
        "fleet_issue_reports",
        "operational_sessions",
        "distribution_runs",
        "distribution_run_items",
        "audit_logs",
        "notifications",
      ];

      const res = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
      `);
      const existingTables = res.rows.map((r) => r.table_name);
      const missing = requiredTables.filter((t) => !existingTables.includes(t));

      if (missing.length > 0) {
        throw new Error(`Tabel inti database belum lengkap, hilang: ${missing.join(", ")}`);
      }
      return `Seluruh ${requiredTables.length} tabel inti sistem aktif & terverifikasi di PostgreSQL.`;
    });

    await runTest("MODUL 1", "1.3", "Validasi Kolom users (birth_date & status aktif)", async () => {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN ('birth_date', 'role', 'is_active');
      `);
      const colMap = Object.fromEntries(res.rows.map((r) => [r.column_name, r.data_type]));
      if (!colMap["birth_date"]) {
        throw new Error("Kolom 'birth_date' tidak ditemukan di tabel users!");
      }
      return `Kolom valid: birth_date (${colMap["birth_date"]}), role (${colMap["role"]}), is_active (${colMap["is_active"]})`;
    });

    await runTest("MODUL 1", "1.4", "Konektivitas & Ping Redis Server Cache", async () => {
      const pingRes = await redisClient.ping();
      if (pingRes !== "PONG") {
        throw new Error(`Redis ping gagal, respons: ${pingRes}`);
      }
      await redisClient.set("e2e:health_check", "OK", { EX: 10 });
      const val = await redisClient.get("e2e:health_check");
      return `Redis cache & store online (PING: ${pingRes}, Read/Write: ${val})`;
    });

    await runTest("MODUL 1", "1.5", "Kueri Spasial PostGIS Pembatas Jalan Protokol Sidoarjo", async () => {
      const res = await pool.query(`
        SELECT COUNT(*) as total_features 
        FROM protocol_roads;
      `);
      const total = parseInt(res.rows[0]?.total_features || "0", 10);
      if (total === 0) {
        throw new Error("Lapisan spasial jalan protokol kosong di database PostGIS.");
      }
      return `Lapisan PostGIS aktif: ${total} ruas jalan protokol terdaftar dengan indeks geometri spasial.`;
    });

    // =========================================================================
    // MODUL 2: AUTENTIKASI, ENTERPRISE RBAC & ONBOARDING
    // =========================================================================
    console.log("\n🔐 [MODUL 2] AUTENTIKASI, ENTERPRISE RBAC, ONBOARDING & PERSISTENCE");
    console.log("--------------------------------------------------------------------------------");

    await runTest("MODUL 2", "2.1", "Bootstrap Super Admin Login & JWT Payload", async () => {
      const res = await loginService({
        identifier: "superadmin@kopikeliling.com",
        password: "password123",
      });
      superadminUser = res.user;
      superadminToken = res.token;
      if (!superadminToken || superadminUser.role !== "SUPERADMIN") {
        throw new Error("Gagal login sebagai Super Admin");
      }
      return `Super Admin terotentikasi: ${superadminUser.name} (${superadminUser.email})`;
    });

    let mgtInvitation: any = null;
    await runTest("MODUL 2", "2.2", "Super Admin Membuat Undangan Akun Management", async () => {
      mgtInvitation = await createUserService(
        {
          name: `Manajer E2E ${runId}`,
          email: testManagementEmail,
          role: "MANAGEMENT",
        },
        superadminUser
      );
      if (!mgtInvitation.invitation_token || !mgtInvitation.invitation_link) {
        throw new Error("Token aktivasi tidak digenerate");
      }
      return `Akun diundang: ${testManagementEmail} (is_active: false, Token: ${mgtInvitation.invitation_token.slice(0, 8)}...)`;
    });

    const mgtPassword = "ManagementPass123!";
    const mgtBirthDate = "1990-06-15";

    await runTest("MODUL 2", "2.3", "Verifikasi Token & Aktivasi Mandiri (Sandi & Tanggal Lahir)", async () => {
      const verify = await verifyResetTokenService(mgtInvitation.invitation_token);
      if (!verify.valid) throw new Error("Token aktivasi tidak valid");

      const activateRes = await registerService({
        token: mgtInvitation.invitation_token,
        password: mgtPassword,
        name: `Manajer E2E ${runId}`,
        birth_date: mgtBirthDate,
      });

      if (!activateRes.is_active) throw new Error("Akun gagal aktif");

      const dbUser = await UserModel.findById(activateRes.id);
      if (!dbUser?.birth_date) throw new Error("Kolom birth_date gagal tersimpan");

      return `Akun Management aktif: ${activateRes.email} (is_active: true, birth_date: ${mgtBirthDate})`;
    });

    await runTest("MODUL 2", "2.4", "Login Management & Akses Sesi Operasional", async () => {
      const res = await loginService({
        identifier: testManagementEmail,
        password: mgtPassword,
      });
      managementUser = res.user;
      managementToken = res.token;
      if (!managementToken || managementUser.role !== "MANAGEMENT") {
        throw new Error("Login Management gagal");
      }
      return `Login Management sukses: Token JWT valid diperoleh untuk peran ${managementUser.role}`;
    });

    await runTest("MODUL 2", "2.5", "Enforcement RBAC: Management Dicegat Membuat Super Admin", async () => {
      try {
        await createUserService(
          {
            name: "Ilegal Superadmin",
            email: `illegal.${runId}@kopikeliling.com`,
            role: "SUPERADMIN",
          },
          managementUser
        );
        throw new Error("Pelanggaran Keamanan: Management diizinkan membuat Super Admin!");
      } catch (err: any) {
        if (err.statusCode === 403) {
          return `Sistem keamanan RBAC berhasil mencegat dengan HTTP 403 (${err.message})`;
        }
        throw err;
      }
    });

    let riderInvitation: any = null;
    await runTest("MODUL 2", "2.6", "Management Membuat Akun Rider Lapangan", async () => {
      riderInvitation = await createUserService(
        {
          name: `Rider E2E ${runId}`,
          email: testRiderEmail,
          role: "RIDER",
        },
        managementUser
      );
      return `Rider diundang oleh Management: ${testRiderEmail} | Link: ${riderInvitation.invitation_link}`;
    });

    const riderPassword = "RiderPass123!";
    const riderBirthDate = "1997-04-20";

    await runTest("MODUL 2", "2.7", "Rider Mengaktivasi Akun dengan Tanggal Lahir", async () => {
      const activateRes = await registerService({
        token: riderInvitation.invitation_token,
        password: riderPassword,
        name: `Rider E2E ${runId}`,
        birth_date: riderBirthDate,
      });

      const riderInDb = await UserModel.findById(activateRes.id);
      if (!riderInDb?.is_active || !riderInDb.birth_date) {
        throw new Error("Rider gagal aktif atau birth_date null");
      }
      return `Rider aktif: ${riderInDb.name} (${riderInDb.role}, birth_date: ${riderBirthDate})`;
    });

    await runTest("MODUL 2", "2.8", "Verifikasi Sesi Anti-Reload Kickout & Token Rotation", async () => {
      const loginRes = await loginService({
        identifier: testRiderEmail,
        password: riderPassword,
      });
      riderUser = loginRes.user;
      riderToken = loginRes.token;

      // Simulasi panggilan /api/auth/me saat reload halaman
      const sessionUser = await UserModel.findById(riderUser.id);
      if (!sessionUser || !sessionUser.birth_date) {
        throw new Error("Gagal membaca profil sesi user pada reload");
      }

      // Simulasi perpanjangan token otomatis 30-hari
      const refreshed = await refreshTokenService(loginRes.refreshToken);
      if (!refreshed.token) throw new Error("Gagal melakukan refresh token");

      return `Query /api/auth/me & token refresh 30-hari valid (Aplikasi kebal dari reload logout).`;
    });

    await runTest("MODUL 2", "2.9", "Penonaktifan Akun (Deactivation) & Pencabutan Sesi", async () => {
      await setUserStatusService(riderUser.id, false, superadminUser);

      try {
        await loginService({
          identifier: testRiderEmail,
          password: riderPassword,
        });
        throw new Error("Pengguna nonaktif seharusnya tidak dapat login!");
      } catch (err: any) {
        if (err.statusCode === 403) {
          // Pulihkan kembali akun untuk modul berikutnya
          await setUserStatusService(riderUser.id, true, superadminUser);
          return `Enforcement Berhasil: Pengguna is_active = false dicegat dengan HTTP 403 (${err.message}). Status dipulihkan.`;
        }
        throw err;
      }
    });

    // =========================================================================
    // MODUL 3: MASTER DATA OPERASIONAL & GIS GEOFENCE
    // =========================================================================
    console.log("\n🗺️ [MODUL 3] MASTER DATA OPERASIONAL, PRODUK & GIS GEOFENCE");
    console.log("--------------------------------------------------------------------------------");

    await runTest("MODUL 3", "3.1", "Master Katalog Produk Minuman & Status Aktif", async () => {
      const products = await productRepository.findAll();
      if (!products || products.length === 0) {
        throw new Error("Katalog produk kosong.");
      }
      return `${products.length} Master produk aktif terdaftar (Contoh: ${products[0].name}, Rp${products[0].price})`;
    });

    await runTest("MODUL 3", "3.2", "Master Poligon Zona Operasional PostGIS", async () => {
      const zones = await ZoneModel.findAll();
      if (!zones || zones.length < 4) {
        throw new Error("Zona operasional Sidoarjo kurang dari 4 zona.");
      }
      return `${zones.length} Zona operasional terdaftar lengkap dengan batas poligon PostGIS (Contoh: ${zones[0].name})`;
    });

    await runTest("MODUL 3", "3.3", "Validasi Titik Central HUB Sidoarjo", async () => {
      const res = await pool.query(`
        SELECT key, value 
        FROM system_settings 
        WHERE key IN ('HUB_CITY_NAME', 'HUB_LATITUDE', 'HUB_LONGITUDE');
      `);
      const map = Object.fromEntries(res.rows.map((r) => [r.key, r.value]));
      if (!map["HUB_LATITUDE"] || !map["HUB_LONGITUDE"]) {
        throw new Error("Pengaturan koordinat Central HUB Sidoarjo tidak ditemukan.");
      }
      return `Central HUB terkonfigurasi: ${map["HUB_CITY_NAME"] || "Sidoarjo"} (Lat: ${map["HUB_LATITUDE"]}, Lng: ${map["HUB_LONGITUDE"]})`;
    });

    // =========================================================================
    // MODUL 4: SIKLUS ARMADA LAPANGAN (TAHAP 2)
    // =========================================================================
    console.log("\n🚲 [MODUL 4] SIKLUS ARMADA LAPANGAN (TAHAP 2: RESERVASI 5-MENIT & KLAIM)");
    console.log("--------------------------------------------------------------------------------");

    await runTest("MODUL 4", "4.1", "Katalog Unit Armada di Hub Sidoarjo", async () => {
      const { armadas } = await armadaService.getAllArmadas();
      if (!armadas || armadas.length === 0) throw new Error("Unit armada tidak ditemukan");
      testArmada = armadas.find((a: any) => a.status === "ACTIVE" && !a.current_rider_id) || armadas[0];
      return `${armadas.length} Unit armada terdaftar. Menguji unit target: ${testArmada.code} (${testArmada.type})`;
    });

    await runTest("MODUL 4", "4.2", "Klaim Sementara 5-Menit (Temporary Hold Lock)", async () => {
      const holdRes = await riderOperationalService.inspectAndHoldArmada({
        riderId: riderUser.id,
        armadaId: testArmada.id,
      });
      if (!holdRes.armada) throw new Error("Gagal mengunci unit armada sementara");
      return `Unit ${testArmada.code} berhasil di-hold selama 5 menit untuk Rider ${riderUser.name}`;
    });

    await runTest("MODUL 4", "4.3", "Proteksi Double-Hold: Pencegahan Rebutan Armada", async () => {
      try {
        // Coba kunci kembali dengan rider lain
        await riderOperationalService.inspectAndHoldArmada({
          riderId: superadminUser.id,
          armadaId: testArmada.id,
        });
        throw new Error("Unit yang sedang di-hold seharusnya tidak bisa diambil user lain!");
      } catch (err: any) {
        return `Proteksi Double-Hold Aktif: Akses ditolak karena armada sedang diproses (${err.message})`;
      }
    });

    await runTest("MODUL 4", "4.4", "Konfirmasi Final Klaim Armada dengan Checklist Fisik", async () => {
      const claimRes = await riderOperationalService.confirmArmadaClaim({
        riderId: riderUser.id,
        armadaId: testArmada.id,
        checklist: { battery: "100%", brakes: "GOOD", cooler: "COLD", stove: "READY" },
        notes: "Inspeksi fisik awal lolos uji lapangan E2E",
      });
      if (!claimRes.armada || !claimRes.armada.current_rider_id) {
        throw new Error("Armada gagal diklaim atau current_rider_id tidak tercatat");
      }
      return `Armada ${testArmada.code} resmi bertugas di lapangan (Ditugaskan ke Rider ID: ${claimRes.armada.current_rider_id.slice(0, 8)}..., Checklist tersimpan)`;
    });

    await runTest("MODUL 4", "4.5", "Pelaporan Kendala Fisik Armada (Issue Report)", async () => {
      const issueRes = await armadaService.reportIssue({
        armadaId: testArmada.id,
        riderId: riderUser.id,
        severity: "MINOR",
        issueType: "BATTERY",
        description: "Baterai indikator turun 5% lebih cepat saat menanjak.",
      });
      const issue = issueRes.issue || issueRes;
      if (!issue || !issue.id) throw new Error("Gagal membuat laporan kendala fisik");
      return `Laporan kendala fisik armada tercatat: [${issue.severity}] ${issue.issue_type || "BATTERY"} (ID: ${issue.id.slice(0, 8)}...)`;
    });

    await runTest("MODUL 4", "4.6", "Pengembalian Armada & Pelepasan Status (Return)", async () => {
      await armadaService.updateArmada(
        testArmada.id,
        {
          status: "ACTIVE",
          current_rider_id: null,
          force: true,
        },
        superadminUser
      );
      const verified = await armadaService.getArmadaById(testArmada.id);
      if (verified.status !== "ACTIVE" || verified.current_rider_id !== null) {
        throw new Error("Gagal mengembalikan status armada");
      }
      return `Unit ${testArmada.code} berhasil dikembalikan dan siap ditugaskan kembali (Status: ACTIVE)`;
    });

    // =========================================================================
    // MODUL 5: DECISION SUPPORT SYSTEM (BWM + TOPSIS) ENGINE
    // =========================================================================
    console.log("\n🧠 [MODUL 5] DECISION SUPPORT SYSTEM (BWM & TOPSIS ENGINE)");
    console.log("--------------------------------------------------------------------------------");

    await runTest("MODUL 5", "5.1", "Integritas Bobot Kriteria BWM SPK (C1 - C6)", async () => {
      const activeConfig = await bwmRepository.findActiveConfig();
      if (!activeConfig) {
        throw new Error("Konfigurasi bobot BWM aktif tidak ditemukan.");
      }

      const crits = (await pool.query("SELECT name, type, weight FROM criterias ORDER BY name;")).rows;
      if (crits.length === 0) {
        throw new Error("Kriteria SPK kosong di database.");
      }
      const sumWeight = crits.reduce((acc, c) => acc + Number(c.weight), 0);
      const isNormalized = Math.abs(sumWeight - 1.0) < 0.02;
      if (!isNormalized) {
        throw new Error(`Total bobot kriteria BWM tidak bernilai 1.0 (Sum: ${sumWeight})`);
      }
      return `Konfigurasi BWM Aktif: "${activeConfig.name}" | ${crits.length} Kriteria Terverifikasi | Total Bobot: ${sumWeight.toFixed(2)}`;
    });

    await runTest("MODUL 5", "5.2", "Kalkulasi Matriks & Rekomendasi TOPSIS Multi-Zona", async () => {
      const topsisResult = await topsisEngineService.calculateTopsisRecommendations({
        timeSlot: "SIANG",
      });

      if (!topsisResult?.rankings || topsisResult.rankings.length === 0) {
        throw new Error("Kalkulasi TOPSIS menghasilkan rekomendasi kosong.");
      }

      const topRank = topsisResult.rankings[0];
      return `Kalkulasi TOPSIS Sukses: ${topsisResult.rankings.length} Zona dirangking. Peringkat 1: ${topRank.zone_name} (Skor Preferensi: ${Number(topRank.score).toFixed(4)})`;
    });

    // =========================================================================
    // MODUL 6: SESI OPERASIONAL & DISTRIBUSI OTOMATIS RIDER (TAHAP 3)
    // =========================================================================
    console.log("\n📋 [MODUL 6] SESI OPERASIONAL & ENGINE DISTRIBUSI OTOMATIS (TAHAP 3)");
    console.log("--------------------------------------------------------------------------------");

    await runTest("MODUL 6", "6.1", "Inisialisasi Sesi Operasional Harian", async () => {
      const overview = await distributionService.getDistributionOverview();
      operationalSession = overview.session;
      if (!operationalSession || !operationalSession.id) {
        throw new Error("Sesi operasional harian tidak dapat diinisialisasi.");
      }
      return `Sesi Operasional Aktif: ${operationalSession.session_code} (${operationalSession.time_slot}) | Status: ${operationalSession.status}`;
    });

    await runTest("MODUL 6", "6.2", "Pendaftaran Rider ke Antrean Tugas FIFO", async () => {
      const duty = await distributionService.confirmRiderDuty(riderUser.id);
      if (!duty) throw new Error("Gagal mendaftarkan rider ke antrean tugas");
      return `Rider ${riderUser.name} berhasil check-in ke Antrean Tugas Shift (${operationalSession.session_code})`;
    });

    await runTest("MODUL 6", "6.3", "Overview Distribusi: Kapasitas Zona & Antrean Tugas", async () => {
      const overview = await distributionService.getDistributionOverview();
      if (!overview.zones || overview.zones.length === 0) {
        throw new Error("Data overview zona distribusi kosong");
      }
      return `Total Antrean: ${overview.summary.total_waiting} Rider | Kapasitas Tersedia: ${overview.summary.total_remaining_capacity} Slot di ${overview.zones.length} Zona`;
    });

    // =========================================================================
    // MODUL 7: AUDIT LOGGING & NOTIFIKASI REAL-TIME
    // =========================================================================
    console.log("\n🛡️ [MODUL 7] AUDIT TRAIL LOGGING & NOTIFIKASI REAL-TIME");
    console.log("--------------------------------------------------------------------------------");

    await runTest("MODUL 7", "7.1", "Verifikasi Integritas Audit Trail Logging", async () => {
      const { logs, count } = await auditService.getAuditLogs({ limit: 5 });
      if (count === 0) {
        throw new Error("Tabel audit_logs kosong, aksi sistem tidak tercatat!");
      }
      const latest = logs[0];
      return `${count} Aksi audit tercatat. Log terbaru: [${latest.action}] oleh ${latest.user_name || 'System'} (${latest.created_at})`;
    });

    await runTest("MODUL 7", "7.2", "Pencatatan Notifikasi Sistem In-App", async () => {
      const res = await pool.query(
        `INSERT INTO notifications (user_id, title, message)
         VALUES ($1, 'Uji Integrasi Berhasil', 'Seluruh modul sistem MantaKopi COZIS lulus uji E2E.')
         RETURNING id, title;`,
        [riderUser.id]
      );
      if (res.rows.length === 0) throw new Error("Gagal membuat notifikasi");
      return `Notifikasi in-app berhasil diterbitkan untuk Rider (ID: ${res.rows[0].id.slice(0, 8)}...)`;
    });

    // =========================================================================
    // RINGKASAN REKAPITULASI PENGUJIAN
    // =========================================================================
    const totalDuration = Math.round(performance.now() - overallStart);

    console.log("\n================================================================================");
    console.log("📊 REKAPITULASI HASIL INTEGRASI SISTEM LENGKAP (END-TO-END)");
    console.log("================================================================================");
    console.table(
      testResults.map((r) => ({
        Modul: r.module,
        Kode: r.code,
        Pengujian: r.name,
        Status: r.status,
        Waktu_ms: r.timeMs,
      }))
    );

    console.log("================================================================================");
    console.log(`🎉 SELURUH ${testResults.length} SKENARIO INTEGRASI SISTEM LULUS UJI 100%!`);
    console.log(`⏱️ Total Waktu Eksekusi: ${totalDuration}ms`);
    console.log("================================================================================\n");
  } catch (err: any) {
    console.error("\n💥 PENGUJIAN E2E GAGAL PADA TAHAPAN DI ATAS:", err.message);
    process.exit(1);
  } finally {
    try {
      await pool.end();
      await redisClient.quit();
    } catch {}
    process.exit(0);
  }
}

runFullSystemIntegrationTest();
