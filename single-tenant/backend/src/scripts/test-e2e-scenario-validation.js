/*
 * test-e2e-scenario-validation.js
 * Comprehensive End-to-End (E2E) Operational Scenario Validation:
 * Flow: Konfirmasi Tugas (FIFO) -> Auto-Plotting (TOPSIS) -> Live LBS GPS Telemetry -> Deteksi Deviasi Geofence.
 */

import http from "http";
import express from "express";
import { io as Client } from "socket.io-client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool, env } from "../config/index.js";
import { socketManager } from "../socket/socketManager.js";
import { registerLbsSocketHandlers } from "../socket/lbsHandler.js";
import { distributionService } from "../services/distribution/DistributionService.js";
import { distributionRepository } from "../repositories/distributionRepository.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || env?.JWT_SECRET || "mantakopi_jwt_secretkey_2026";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [ASSERTION FAILED] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`   ✅ ${message}`);
}

async function runE2EScenarioValidation() {
  console.log("\n" + "=".repeat(85));
  console.log("🚀 MEMULAI END-TO-END (E2E) OPERATIONAL SCENARIO VALIDATION");
  console.log("   Skenario: Konfirmasi Tugas -> FIFO Auto-Plotting -> Live Telemetri -> Deviasi Geofence");
  console.log("=".repeat(85));

  // Initialize Isolated Test Server for Sockets
  const app = express();
  const server = http.createServer(app);
  const io = socketManager.init(server, true);
  registerLbsSocketHandlers(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  const BASE_URL = `http://localhost:${testPort}`;

  let supervisorSocket = null;
  let riderSocket = null;

  try {
    // -------------------------------------------------------------------------
    // STAGE 0: Setup Test Entities & Database Readiness
    // -------------------------------------------------------------------------
    console.log("\n📦 [STAGE 0] Setup & Verifikasi Entitas Database...");
    
    let { rows: riders } = await pool.query(
      "SELECT id, name, username, email, role FROM users WHERE role = 'RIDER' ORDER BY id ASC LIMIT 3;"
    );

    if (riders.length < 2) {
      console.log("   ℹ️ Membuat user Rider test untuk validasi skenario FIFO...");
      const insertRiders = await pool.query(`
        INSERT INTO users (name, username, email, password, role)
        VALUES 
          ('Budi Santoso (E2E)', 'rider_e2e_1', 'rider_e2e_1@mova.id', 'hashedpass', 'RIDER'),
          ('Siti Rahma (E2E)', 'rider_e2e_2', 'rider_e2e_2@mova.id', 'hashedpass', 'RIDER')
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, username, email, role;
      `);
      riders = insertRiders.rows;
    }

    let { rows: supervisors } = await pool.query(
      "SELECT id, name, username, email, role FROM users WHERE role IN ('SUPERVISOR', 'SUPERADMIN') LIMIT 1;"
    );

    if (supervisors.length === 0) {
      console.log("   ℹ️ Membuat user Supervisor test...");
      const insertSup = await pool.query(`
        INSERT INTO users (name, username, email, password, role)
        VALUES ('Supervisor Sidoarjo (E2E)', 'spv_e2e', 'spv_e2e@mova.id', 'hashedpass', 'SUPERVISOR')
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, username, email, role;
      `);
      supervisors = insertSup.rows;
    }

    const rider1 = riders[0];
    const rider2 = riders[1];
    const supervisor = supervisors[0];

    assert(rider1 && rider2, `Minimal 2 Rider tersedia untuk pengujian FIFO (${rider1.name}, ${rider2.name})`);
    assert(supervisor, `Supervisor tersedia (${supervisor.name})`);

    // Reset today's distribution data
    await distributionRepository.resetTodayDistribution();
    console.log("   🧹 Reset antrean & penugasan hari ini berhasil dilakukan.");

    // -------------------------------------------------------------------------
    // STAGE 1: Konfirmasi Tugas (FIFO Queue Ingestion & Deterministic Ordering)
    // -------------------------------------------------------------------------
    console.log("\n📋 [STAGE 1] Simulasi Konfirmasi Kesediaan Bertugas (FIFO Ingestion)...");

    // Rider 1 confirms first
    const queue1 = await distributionService.confirmRiderDuty(rider1.id);
    console.log(`   ⏱️ [T1] Rider '${rider1.name}' konfirmasi tugas -> Status: ${queue1.status}`);
    await new Promise((r) => setTimeout(r, 200)); // Delay to ensure discrete timestamps

    // Rider 2 confirms second
    const queue2 = await distributionService.confirmRiderDuty(rider2.id);
    console.log(`   ⏱️ [T2] Rider '${rider2.name}' konfirmasi tugas -> Status: ${queue2.status}`);

    const overviewPre = await distributionService.getDistributionOverview("siang");
    assert(overviewPre.total_waiting_riders >= 2, `Total antrean menunggu bertugas minimal 2 (Aktual: ${overviewPre.total_waiting_riders})`);
    assert(overviewPre.waiting_queue[0].rider_id === rider1.id, `Urutan FIFO #1 adalah Rider 1 (${rider1.name})`);
    assert(overviewPre.waiting_queue[1].rider_id === rider2.id, `Urutan FIFO #2 adalah Rider 2 (${rider2.name})`);

    // -------------------------------------------------------------------------
    // STAGE 2: Eksekusi Engine Distribusi Otomatis (FIFO + TOPSIS Zone Rank)
    // -------------------------------------------------------------------------
    console.log("\n🤖 [STAGE 2] Eksekusi FIFO Auto-Plotting Engine (Matching ke Rank TOPSIS)...");

    const autoPlotResult = await distributionService.autoDistributeRiders(supervisor.id, "siang");
    assert(autoPlotResult.assigned_riders_count >= 2, `Minimal 2 rider berhasil di-plot otomatis (Aktual: ${autoPlotResult.assigned_riders_count})`);
    assert(typeof autoPlotResult.distribution_run_id === "string", `Distribution run ID tersimpan: ${autoPlotResult.distribution_run_id}`);

    // Verify status transition in DB
    const r1Status = await distributionService.getRiderOperationalStatus(rider1.id);
    assert(
      r1Status.duty_status === "PLOTTED" || r1Status.duty_status === "ASSIGNED" || r1Status.assignment !== null,
      `Status Rider 1 berubah menjadi PLOTTED/ASSIGNED (Aktual: ${r1Status.duty_status})`
    );
    console.log(`   📍 Rider 1 '${rider1.name}' ter-plot ke Zona: ${r1Status.assignment?.zone_name || "Zona Rekomendasi"}`);

    const overviewPost = await distributionService.getDistributionOverview("siang");
    assert(overviewPost.total_waiting_riders === 0, `Antrean FIFO telah kosong setelah auto-plotting selesai`);

    // -------------------------------------------------------------------------
    // STAGE 3: Live LBS Telemetri & WebSockets Handshake
    // -------------------------------------------------------------------------
    console.log("\n🔌 [STAGE 3] Inisialisasi Koneksi Socket.io & Live GPS Telemetri...");

    const supervisorToken = jwt.sign(supervisor, JWT_SECRET, { expiresIn: "1h" });
    const riderToken = jwt.sign(rider1, JWT_SECRET, { expiresIn: "1h" });

    supervisorSocket = Client(BASE_URL, {
      auth: { token: supervisorToken },
      transports: ["polling", "websocket"],
    });

    riderSocket = Client(BASE_URL, {
      auth: { token: riderToken },
      transports: ["polling", "websocket"],
    });

    await Promise.all([
      new Promise((res) => supervisorSocket.on("connect", res)),
      new Promise((res) => riderSocket.on("connect", res)),
    ]);

    assert(supervisorSocket.connected, `Supervisor Socket connected (ID: ${supervisorSocket.id})`);
    assert(riderSocket.connected, `Rider Socket connected (ID: ${riderSocket.id})`);

    // Listen to supervisor live stream
    let supervisorReceivedMovement = false;
    let receivedGpsPayload = null;
    supervisorSocket.on("supervisor:rider_moved", (data) => {
      supervisorReceivedMovement = true;
      receivedGpsPayload = data;
    });

    // Emit normal in-zone location (Alun-Alun Sidoarjo coordinates)
    riderSocket.emit("rider:location_update", {
      lat: -7.4478,
      lon: 112.7183,
      speed: 12.4,
      heading: 180,
    });

    await new Promise((r) => setTimeout(r, 600));
    assert(supervisorReceivedMovement, "Supervisor berhasil menerima stream GPS live rider tanpa reload");
    assert(receivedGpsPayload.rider_id === rider1.id, `Payload GPS sesuai untuk rider ${rider1.name}`);

    // -------------------------------------------------------------------------
    // STAGE 4: Deteksi Deviasi Geofence Real-Time (PostGIS Boundary Violation)
    // -------------------------------------------------------------------------
    console.log("\n🚨 [STAGE 4] Simulasi Pelanggaran Batas Wilayah (Deteksi Deviasi Geofence)...");

    let riderReceivedBreachWarning = false;
    let supervisorReceivedBreachAlert = false;
    let breachWarningMessage = "";

    riderSocket.on("rider:geofence_warning", (payload) => {
      const data = payload?.data || payload;
      riderReceivedBreachWarning = true;
      breachWarningMessage = data.message || payload?.message || "";
      console.log(`   ⚠️ [RIDER APP NOTIFIKASI] ${breachWarningMessage}`);
    });

    supervisorSocket.on("supervisor:geofence_alert", (payload) => {
      const data = payload?.data || payload;
      supervisorReceivedBreachAlert = true;
      console.log(`   🚨 [SUPERVISOR DASHBOARD ALERT] Deviasi terdeteksi pada ${data.rider_name || "Rider"} di ${data.zone_name || "Zona"}!`);
    });

    // Emit out-of-zone location far away from Sidoarjo zone
    riderSocket.emit("rider:location_update", {
      lat: -7.6500, // Out of zone
      lon: 112.3000,
      speed: 25.0,
      heading: 90,
    });

    await new Promise((r) => setTimeout(r, 1000));
    assert(riderReceivedBreachWarning, "Sistem PostGIS mendeteksi deviasi dan mengirim peringatan geofence ke Rider");
    assert(breachWarningMessage.includes("PERINGATAN GEOFENCE"), "Pesan peringatan deviasi memuat header PERINGATAN GEOFENCE");
    assert(supervisorReceivedBreachAlert, "Dashboard Supervisor menerima broadcast alarm deviasi geofence real-time");

    // -------------------------------------------------------------------------
    // STAGE 5: Ringkasan & Sukses
    // -------------------------------------------------------------------------
    console.log("\n" + "=".repeat(85));
    console.log("🎉 SELURUH SKENARIO END-TO-END (E2E) BERHASIL DIVALIDASI 100%!");
    console.log("   • Konfirmasi Tugas (FIFO Queue)      : VALID ✅");
    console.log("   • TOPSIS FIFO Auto-Plotting Engine    : VALID ✅");
    console.log("   • Live WebSockets LBS Telemetry      : VALID ✅");
    console.log("   • PostGIS Spatial Geofence Deviation : VALID ✅");
    console.log("   • Real-Time Supervisor Alarm Stream  : VALID ✅");
    console.log("=".repeat(85) + "\n");

  } catch (error) {
    console.error("💥 [E2E VALIDATION ERROR]", error);
    process.exit(1);
  } finally {
    if (supervisorSocket) supervisorSocket.disconnect();
    if (riderSocket) riderSocket.disconnect();
    server.close();
    await pool.end();
    process.exit(0);
  }
}

runE2EScenarioValidation();

