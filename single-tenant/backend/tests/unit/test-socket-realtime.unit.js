/*
 * test-socket-realtime.unit.js
 * Unit Test Suite for SocketManager, LBS Point-In-Polygon Engine, Handshake Auth, and Event Envelopes.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import { io as ClientIO } from "socket.io-client";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import { SocketManager } from "../../src/socket/socketManager.js";
import { isPointInPolygonRing } from "../../src/socket/lbsHandler.js";
import { EventPublisher } from "../../src/events/eventPublisher.js";
import { EVENT_TYPES } from "../../src/events/eventTypes.js";

import { redisClient } from "../../src/config/redis.js";
import { pool } from "../../src/config/database.js";

describe("⚡ [UNIT] Socket.IO Real-Time Engine & LBS Fast-Path", () => {
  let server;
  let socketMgr;
  let port;
  let baseUrl;

  const samplePolygonVertices = [
    [112.7100, -7.4400],
    [112.7300, -7.4400],
    [112.7300, -7.4600],
    [112.7100, -7.4600],
    [112.7100, -7.4400],
  ];

  before(async () => {
    const app = express();
    server = http.createServer(app);
    socketMgr = new SocketManager();
    socketMgr.init(server, true);

    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    if (socketMgr) {
      socketMgr.close();
    }
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
      await redisClient.quit();
    }
    if (pool) {
      await pool.end();
    }
  });

  describe("1. LBS Fast-Path Point-in-Polygon Ray-Casting", () => {
    it("harus mendeteksi koordinat di DALAM poligon geofence secara akurat", () => {
      const insidePoint = [112.7200, -7.4500]; // Inside boundary
      const isInside = isPointInPolygonRing(insidePoint, samplePolygonVertices);
      assert.strictEqual(isInside, true, "Titik di dalam poligon harus menghasilkan true");
    });

    it("harus mendeteksi koordinat di LUAR poligon geofence secara akurat", () => {
      const outsidePoint = [112.5000, -7.5000]; // Far outside
      const isInside = isPointInPolygonRing(outsidePoint, samplePolygonVertices);
      assert.strictEqual(isInside, false, "Titik di luar poligon harus menghasilkan false");
    });

    it("harus mengembalikan true jika daftar vertices tidak valid/kosong (safe fallback)", () => {
      assert.strictEqual(isPointInPolygonRing([112.72, -7.45], []), true);
      assert.strictEqual(isPointInPolygonRing([112.72, -7.45], null), true);
    });
  });

  describe("2. Socket.IO Handshake Authentication & Error Codes", () => {
    it("harus menolak handshake tanpa token dengan kode AUTH_REQUIRED", async () => {
      const socket = ClientIO(baseUrl, {
        transports: ["websocket"],
        reconnection: false,
        timeout: 2000,
      });

      const err = await new Promise((resolve) => {
        socket.on("connect_error", (error) => resolve(error));
        socket.on("connect", () => resolve(null));
      });

      assert.ok(err, "Koneksi tanpa token harus gagal");
      assert.strictEqual(err.data?.code, "AUTH_REQUIRED");
      socket.close();
    });

    it("harus menolak handshake dengan token palsu/invalid dengan kode AUTH_INVALID", async () => {
      const socket = ClientIO(baseUrl, {
        auth: { token: "fake.invalid.token" },
        transports: ["websocket"],
        reconnection: false,
        timeout: 2000,
      });

      const err = await new Promise((resolve) => {
        socket.on("connect_error", (error) => resolve(error));
        socket.on("connect", () => resolve(null));
      });

      assert.ok(err, "Koneksi dengan token invalid harus gagal");
      assert.strictEqual(err.data?.code, "AUTH_INVALID");
      socket.close();
    });

    it("harus berhasil terhubung dan join room yang sesuai dengan valid JWT", async () => {
      const riderToken = jwt.sign(
        { id: "rider-unit-1", name: "Rider Unit Test", email: "rider@unit.test", role: "RIDER" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const socket = ClientIO(baseUrl, {
        auth: { token: riderToken },
        transports: ["websocket"],
        reconnection: false,
        timeout: 3000,
      });

      await new Promise((resolve, reject) => {
        socket.on("connect", resolve);
        socket.on("connect_error", reject);
      });

      assert.strictEqual(socket.connected, true);
      assert.strictEqual(socketMgr.isUserConnected("rider-unit-1"), true);
      assert.ok(socketMgr.getConnectedClientsCount() >= 1);

      socket.close();
    });
  });


  describe("3. Canonical EventPublisher & Role-Projection Payload Integrity", () => {
    it("harus menghasilkan deterministik event envelope dengan role projection pada penjualan POS", () => {
      const mockManager = {
        broadcastToManagement: (evt, data) => {},
        broadcastToSupervisors: (evt, data) => {},
        sendToRider: (riderId, evt, data) => {},
        broadcastAll: (evt, data) => {},
      };

      const publisher = new EventPublisher(mockManager);
      const { mgtPayload, spvPayload } = publisher.publishSaleRecorded({
        saleId: "sale-unit-999",
        assignmentId: "assign-1",
        riderId: "rider-1",
        riderName: "Rider Unit",
        zoneId: "zone-1",
        zoneName: "Zona Uji Coba",
        productId: "prod-1",
        productName: "Kopi Hitam Mantap",
        qty: 3,
        unitPrice: 15000,
        totalPrice: 45000,
      });

      // Management payload check
      assert.strictEqual(mgtPayload.type, EVENT_TYPES.SALE_RECORDED);
      assert.strictEqual(mgtPayload.event_id, "evt_sale_sale-unit-999");
      assert.strictEqual(mgtPayload.data.total_price, 45000);
      assert.strictEqual(mgtPayload.data.unit_price, 15000);

      // Supervisor payload check (Financial figures redacted)
      assert.strictEqual(spvPayload.type, EVENT_TYPES.SALE_RECORDED);
      assert.strictEqual(spvPayload.event_id, "evt_sale_sale-unit-999");
      assert.strictEqual(spvPayload.data.qty, 3);
      assert.strictEqual(spvPayload.data.unit_price, undefined, "Supervisor payload tidak boleh membocorkan unit_price");
      assert.strictEqual(spvPayload.data.total_price, undefined, "Supervisor payload tidak boleh membocorkan total_price");
    });
  });
});
