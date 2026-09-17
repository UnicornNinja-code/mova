/*
 * test-lbs-geofence.unit.js
 * Unit Test Suite for LbsGeofenceService following TDD (Red-Green-Refactor) & Testing Patterns.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { LbsGeofenceService } from "../../src/services/lbs/LbsGeofenceService.js";
import { getMockTelemetry } from "../factories/mockFactories.js";
import { pool } from "../../src/config/database.js";

describe("🛰️ [UNIT] LBS Geofencing & Telemetry Normalization Engine", () => {
  const service = new LbsGeofenceService();

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe("1. Coordinate Normalization & Validation", () => {
    it("harus menormalisasi koordinat valid dengan alias lat/lon", () => {
      const ping = getMockTelemetry({ lat: -7.4478, lon: 112.7183, speed: 25.5, heading: 90 });
      const res = service.parseAndValidatePing(ping);
      assert.strictEqual(res.latitude, -7.4478);
      assert.strictEqual(res.longitude, 112.7183);
      assert.strictEqual(res.speed, 25.5);
      assert.strictEqual(res.heading, 90);
    });

    it("harus menormalisasi koordinat string dan menangani boundary speed/heading", () => {
      const ping = getMockTelemetry({ latitude: "-7.5000", longitude: "112.8000", speed: -5, heading: 450 });
      const res = service.parseAndValidatePing(ping);
      assert.strictEqual(res.latitude, -7.5);
      assert.strictEqual(res.longitude, 112.8);
      assert.strictEqual(res.speed, 0, "Negative speed should be clamped to 0");
      assert.strictEqual(res.heading, 90, "Heading 450 should wrap to 90 degrees");
    });
  });

  describe("2. Defensive Coordinate Rejection (Out of Bounds & NaN)", () => {
    it("harus menolak Latitude > 90 dengan kode 400 Bad Request", () => {
      assert.throws(
        () => service.parseAndValidatePing(getMockTelemetry({ latitude: 95, longitude: 112.7 })),
        (err) => err.statusCode === 400 && err.message.includes("latitude")
      );
    });

    it("harus menolak Longitude > 180 dengan kode 400 Bad Request", () => {
      assert.throws(
        () => service.parseAndValidatePing(getMockTelemetry({ latitude: -7.4, longitude: 190 })),
        (err) => err.statusCode === 400 && err.message.includes("longitude")
      );
    });

    it("harus menolak koordinat NaN, null, atau string kosong", () => {
      assert.throws(
        () => service.parseAndValidatePing(getMockTelemetry({ lat: "not-a-number", lon: 112.7 })),
        (err) => err.statusCode === 400 && err.message.includes("latitude")
      );

      assert.throws(
        () => service.parseAndValidatePing({ latitude: null, longitude: 112.7183 }),
        (err) => err.statusCode === 400
      );

      assert.throws(
        () => service.parseAndValidatePing({ latitude: -7.4478, longitude: "" }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("3. Geodesic Haversine Distance Calculation", () => {
    it("harus menghitung jarak geodesik antar dua titik koordinat secara akurat (number signature)", () => {
      // Surabaya (-7.2575, 112.7521) ke Sidoarjo (-7.4478, 112.7183) ~21.5 km
      const distMeters = service.calculateHaversineDistance(-7.2575, 112.7521, -7.4478, 112.7183);
      assert.ok(distMeters > 20000 && distMeters < 23000, `Expected ~21.5km, got ${distMeters}m`);
    });

    it("harus menghitung jarak geodesik dengan object signature ({lat, lon})", () => {
      const p1 = { lat: -7.2575, lon: 112.7521 };
      const p2 = { lat: -7.4478, lon: 112.7183 };
      const distMeters = service.calculateGeodesicDistance(p1, p2);
      assert.ok(distMeters > 20000 && distMeters < 23000, `Expected ~21.5km, got ${distMeters}m`);
    });

    it("harus mengembalikan 0 jika titik koordinat sama", () => {
      const dist = service.calculateHaversineDistance(-7.4478, 112.7183, -7.4478, 112.7183);
      assert.strictEqual(dist, 0);

      const distObj = service.calculateGeodesicDistance({ lat: -7.4478, lon: 112.7183 }, { lat: -7.4478, lon: 112.7183 });
      assert.strictEqual(distObj, 0);
    });
  });
});
