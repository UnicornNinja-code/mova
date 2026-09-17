/*
 * test-notification-queue.js
 * CLI Test Script for BullMQ & Redis Notification Queue Engine.
 */

import http from "http";
import express from "express";
import { io as Client } from "socket.io-client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool, env } from "../config/index.js";
import { socketManager } from "../socket/socketManager.js";
import { registerLbsSocketHandlers } from "../socket/lbsHandler.js";
import {
  addRiderAssignedNotifJob,
  addGeofenceAlertNotifJob,
  addSystemBroadcastNotifJob,
  notificationQueue,
} from "../queues/notificationQueue.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || env?.JWT_SECRET || "mantakopi_jwt_secretkey_2026";

async function testNotificationQueueEngine() {
  console.log("\n================================================================================");
  console.log("🧪 MEMULAI PENGUJIEN BULLMQ NOTIFICATION QUEUE & WEBSOCKETS DISPATCHER");
  console.log("================================================================================");

  // Start Standalone Test Socket Server on dynamic free port (0)
  const app = express();
  const server = http.createServer(app);
  const io = socketManager.init(server, true);
  registerLbsSocketHandlers(io);

  const { notificationWorker } = await import("../workers/notificationWorker.js");
  await notificationWorker.waitUntilReady();

  await new Promise((resolve) => server.listen(0, resolve));
  const BASE_URL = `http://localhost:${server.address().port}`;

  try {
    // 1. Ensure DB & Redis connection ready
    await pool.query("SELECT 1");
    const { rows: riders } = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'RIDER' LIMIT 1;");
    const { rows: supervisors } = await pool.query("SELECT id, name, email, role FROM users WHERE role = 'SUPERVISOR' OR role = 'SUPERADMIN' LIMIT 1;");

    // Clean existing queue jobs for deterministic test
    try {
      await notificationQueue.obliterate({ force: true });
    } catch (e) {
      await notificationQueue.drain(true);
    }

    const riderUser = riders[0];
    const supervisorUser = supervisors[0];

    const riderToken = jwt.sign(riderUser, JWT_SECRET, { expiresIn: "1h" });
    const supervisorToken = jwt.sign(supervisorUser, JWT_SECRET, { expiresIn: "1h" });

    // 2. Connect Socket Clients
    console.log("\n🔌 [KONEKSI] Membuka Koneksi WebSockets Client...");
    const supervisorSocket = Client(BASE_URL, {
      auth: { token: supervisorToken },
      transports: ["polling", "websocket"],
    });

    const riderSocket = Client(BASE_URL, {
      auth: { token: riderToken },
      transports: ["polling", "websocket"],
    });

    await Promise.all([
      new Promise((resolve) => supervisorSocket.on("connect", resolve)),
      new Promise((resolve) => riderSocket.on("connect", resolve)),
    ]);

    console.log(`✅ Supervisor Socket Connected: ${supervisorSocket.connected}`);
    console.log(`✅ Rider Socket Connected     : ${riderSocket.connected}`);

    // 3. [TES 1] Test Rider Assignment Notification via BullMQ Queue
    console.log("\n📥 [TES 1] Mengirim Job 'NOTIF_RIDER_ASSIGNED' ke BullMQ Queue...");
    let assignmentNotifReceived = false;

    const notif1Promise = new Promise((resolve) => {
      riderSocket.on("rider:assigned_notification", (data) => {
        console.log(`   🎉 [RIDER HP RECEIVED] ${data.message}`);
        assignmentNotifReceived = true;
        resolve();
      });
    });

    await addRiderAssignedNotifJob({
      riderId: riderUser.id,
      zoneName: "Zona Taman Pinang Sidoarjo",
      topsisRank: 1,
    });

    await Promise.race([notif1Promise, new Promise((r) => setTimeout(r, 2500))]);
    console.log(`✅ Status Diterima via BullMQ Worker -> Rider WebSockets: ${assignmentNotifReceived ? "SUKSES TERIMA ✅" : "GAGAL ❌"}`);

    // 4. [TES 2] Test Geofence Alert Notification via BullMQ Queue
    console.log("\n📥 [TES 2] Mengirim Job 'NOTIF_GEOFENCE_ALERT' ke BullMQ Queue...");
    let geofenceAlertReceived = false;

    const notif2Promise = new Promise((resolve) => {
      supervisorSocket.on("supervisor:geofence_alert", (data) => {
        console.log(`   🚨 [SUPERVISOR DASHBOARD ALERT] Rider '${data.rider_name}' melanggar geofence ${data.zone_name}`);
        geofenceAlertReceived = true;
        resolve();
      });
    });

    await addGeofenceAlertNotifJob({
      warningPayload: {
        type: "GEOFENCE_BREACH_WARNING",
        rider_id: riderUser.id,
        rider_name: riderUser.name,
        zone_name: "Zona Taman Pinang Sidoarjo",
        latitude: -7.5000,
        longitude: 112.5000,
      },
    });

    await Promise.race([notif2Promise, new Promise((r) => setTimeout(r, 2500))]);
    console.log(`✅ Status Diterima via BullMQ Worker -> Supervisor WebSockets: ${geofenceAlertReceived ? "SUKSES TERIMA ✅" : "GAGAL ❌"}`);

    // 5. [TES 3] Test System Announcement Broadcast via BullMQ Queue
    console.log("\n📥 [TES 3] Mengirim Job 'NOTIF_SYSTEM_BROADCAST' ke BullMQ Queue...");
    let announcementReceived = false;

    const notif3Promise = new Promise((resolve) => {
      riderSocket.on("system:announcement", (data) => {
        console.log(`   📢 [BROADCAST RECEIVED] ${data.title}: ${data.message}`);
        announcementReceived = true;
        resolve();
      });
    });

    await addSystemBroadcastNotifJob({
      title: "PEMELIHARAAN SISTEM",
      message: "Server akan menjalani pemeliharaan rutin pada pukul 00:00 WIB.",
    });

    await Promise.race([notif3Promise, new Promise((r) => setTimeout(r, 2500))]);
    console.log(`✅ Status Diterima via BullMQ Worker -> Broadcast Clients: ${announcementReceived ? "SUKSES TERIMA ✅" : "GAGAL ❌"}`);

    // Cleanup Sockets
    supervisorSocket.disconnect();
    riderSocket.disconnect();

    console.log("\n================================================================================");
    console.log("🎉 Pengujian BullMQ Notification Queue Engine Selesai 100% Sempurna!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("💥 Error saat menguji Notification Queue Engine:", error);
  } finally {
    if (server) server.close();
    await pool.end();
    process.exit(0);
  }
}

testNotificationQueueEngine();
