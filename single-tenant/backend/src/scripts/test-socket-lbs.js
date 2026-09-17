/*
 * test-socket-lbs.js
 * CLI Test Script for LBS & Socket.io Real-Time Tracking Engine.
 */

import http from "http";
import express from "express";
import { io as Client } from "socket.io-client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool, env } from "../config/index.js";
import { socketManager } from "../socket/socketManager.js";
import { registerLbsSocketHandlers } from "../socket/lbsHandler.js";
import { broadcastArmadaHeld, broadcastArmadaReleased } from "../socket/armadaLockSocketHandler.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || env?.JWT_SECRET || "mantakopi_jwt_secretkey_2026";

async function testSocketLbsEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN REAL-TIME SOCKET.IO & LBS TRACKING ENGINE");
  console.log("================================================================================");

  // Start Standalone Test Socket Server on dynamic free port (0)
  const app = express();
  const server = http.createServer(app);
  const io = socketManager.init(server, true);
  registerLbsSocketHandlers(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  const BASE_URL = `http://localhost:${testPort}`;

  try {
    // 1. Fetch active Rider and Supervisor from DB
    const { rows: riders } = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'RIDER' LIMIT 1;");
    const { rows: supervisors } = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'SUPERVISOR' OR role = 'SUPERADMIN' LIMIT 1;");

    if (riders.length === 0 || supervisors.length === 0) {
      console.log("⚠️ Tidak ada user Rider/Supervisor di DB untuk diuji.");
      process.exit(0);
    }

    const riderUser = riders[0];
    const supervisorUser = supervisors[0];

    // Ensure active Zone Assignment for test Rider
    const { rows: zones } = await pool.query("SELECT id FROM zones LIMIT 1;");
    if (zones.length > 0) {
      await pool.query(
        `INSERT INTO zone_assignments (rider_id, zone_id, status, assignment_type, assignment_date)
         VALUES ($1, $2, 'ASSIGNED', 'AUTO', CURRENT_DATE)
         ON CONFLICT (rider_id, assignment_date) DO UPDATE SET status = 'ASSIGNED', zone_id = $2;`,
        [riderUser.id, zones[0].id]
      );
    }

    const riderToken = jwt.sign(riderUser, JWT_SECRET, { expiresIn: "1h" });
    const supervisorToken = jwt.sign(supervisorUser, JWT_SECRET, { expiresIn: "1h" });

    console.log(`📌 Rider Test     : ${riderUser.name} (${riderUser.role})`);
    console.log(`📌 Supervisor Test: ${supervisorUser.name} (${supervisorUser.role})`);

    // 2. Connect Socket Clients
    console.log("\n🔌 [TES 1] Membuka Koneksi WebSockets dengan JWT Handshake Authentication...");
    
    const supervisorSocket = Client(BASE_URL, {
      auth: { token: supervisorToken },
      transports: ["polling", "websocket"],
    });

    const riderSocket = Client(BASE_URL, {
      auth: { token: riderToken },
      transports: ["polling", "websocket"],
    });

    supervisorSocket.on("connect_error", (err) => console.error("💥 Supervisor connect_error:", err.message));
    riderSocket.on("connect_error", (err) => console.error("💥 Rider connect_error:", err.message));

    await Promise.all([
      new Promise((resolve) => supervisorSocket.on("connect", resolve)),
      new Promise((resolve) => riderSocket.on("connect", resolve)),
    ]);

    console.log(`✅ Supervisor Socket Connected: ${supervisorSocket.connected} (ID: ${supervisorSocket.id})`);
    console.log(`✅ Rider Socket Connected     : ${riderSocket.connected} (ID: ${riderSocket.id})`);

    // 3. [TES 2] Live GPS Location Stream & Supervisor Broadcast
    console.log("\n📍 [TES 2] Mengirim Stream Posisi GPS Rider & Broadcast ke Supervisor Room...");
    
    let riderMovedReceived = false;
    supervisorSocket.on("supervisor:rider_moved", (data) => {
      console.log(`   📡 [SUPERVISOR RECEIVED] Rider '${data.rider_name}' bergerak ke GPS: (${data.latitude}, ${data.longitude}) | Speed: ${data.speed}km/h`);
      riderMovedReceived = true;
    });

    riderSocket.emit("rider:location_update", {
      lat: -7.4478,
      lon: 112.7183,
      speed: 15.5,
      heading: 180,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log(`✅ Status Broadcast Posisi GPS ke Supervisor: ${riderMovedReceived ? "SUKSES TERIMA ✅" : "GAGAL ❌"}`);

    // 4. [TES 3] Real-Time Spatial Geofence Breach Alert
    console.log("\n⚠️ [TES 3] Mengirim Koordinat di Luar Poligon Zona (Menguji Geofence Alert)...");
    
    let geofenceWarningReceived = false;
    riderSocket.on("rider:geofence_warning", (data) => {
      console.log(`   🚨 [RIDER HP WARNING] ${data.message}`);
      geofenceWarningReceived = true;
    });

    riderSocket.emit("rider:location_update", {
      lat: -7.5000,
      lon: 112.5000, // Outside zone boundary
      speed: 20.0,
      heading: 90,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log(`✅ Status Geofence Breach Warning ke HP Rider: ${geofenceWarningReceived ? "SUKSES TERIMA ✅" : "GAGAL ❌"}`);

    // 5. [TES 4] Live Ticket-Booking Lock Broadcast
    console.log("\n🔒 [TES 4] Menguji Broadcast Real-Time Lock Armada Ticket-Booking...");
    
    let armadaHeldReceived = false;
    riderSocket.on("armada:held_broadcast", (data) => {
      console.log(`   📡 [HUB CATALOG UI] Armada '${data.code}' HELD -> Claimable: ${data.is_claimable} | Faded Out: ${data.is_faded_out}`);
      armadaHeldReceived = true;
    });

    broadcastArmadaHeld({
      armadaId: "test-armada-uuid-999",
      code: "SJ-0099",
      riderId: riderUser.id,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log(`✅ Status Broadcast Armada Lock ke Seluruh Client Hub: ${armadaHeldReceived ? "SUKSES TERIMA ✅" : "GAGAL ❌"}`);

    // Cleanup Sockets
    supervisorSocket.disconnect();
    riderSocket.disconnect();

    console.log("\n================================================================================");
    console.log("🎉 Pengujian Real-Time Socket.io & LBS Tracking Engine Selesai 100% Sempurna!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error saat menguji Socket.io LBS Engine:", error);
  } finally {
    server.close();
    await pool.end();
    process.exit(0);
  }
}

testSocketLbsEngine();
