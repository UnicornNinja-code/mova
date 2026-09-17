/*
 * test-rider-operational.unit.js
 * Unit Test Suite for RiderOperationalService following TDD (Red-Green-Refactor) & Testing Patterns.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { RiderOperationalService } from "../../src/services/rider/RiderOperationalService.js";
import { getMockUser, getMockProduct, getMockZone } from "../factories/mockFactories.js";
import { pool } from "../../src/config/database.js";
import { redisClient } from "../../src/config/redis.js";
import { armadaHoldQueue } from "../../src/queues/armadaHoldQueue.js";
import { sharedRedisConnection } from "../../src/config/redisConfig.js";

describe("🛵 [UNIT] Rider Operational Service & POS Defense Engine", () => {
  const mockUser = getMockUser({ id: "rider-1" });
  const mockProd = getMockProduct({ id: "prod-1", price: 15000, status: "AVAILABLE" });
  const mockZone = getMockZone({ id: "zone-123", name: "Zone Pusat" });

  const mockRepo = {
    findActiveRiderSession: async () => ({
      session_id: "sess-123",
      assignment_id: "assign-123",
      zone_id: mockZone.id,
      session_status: "OPERATING",
      assignment_status: "CHECKED_IN",
    }),
    findZoneCoveringPoint: async () => mockZone,
    insertSalesLog: async (payload) => ({ id: "sale-1", ...payload }),
  };

  const mockProductRepo = {
    findById: async (id) => (id === mockProd.id ? mockProd : null),
  };

  const service = new RiderOperationalService(mockRepo, null, mockProductRepo);

  after(async () => {
    if (armadaHoldQueue) {
      await armadaHoldQueue.close();
    }
    if (sharedRedisConnection) {
      await sharedRedisConnection.quit();
    }
    if (redisClient && (redisClient.isOpen || redisClient.isReady)) {
      await redisClient.quit();
    }
    if (pool) {
      await pool.end();
    }
  });

  describe("1. Quantity Validation & Defensive Bounds", () => {
    it("harus mencatat penjualan valid dengan perhitungan total harga yang tepat", async () => {
      const res = await service.recordProductSale({
        riderId: mockUser.id,
        productId: mockProd.id,
        quantity: 3,
        lat: -7.4478,
        lon: 112.7183,
      });
      assert.strictEqual(res.sales_log.quantity, 3);
      assert.strictEqual(res.sales_log.total_price, 45000);
    });

    it("harus menolak penjualan dengan quantity <= 0", async () => {
      await assert.rejects(
        async () => service.recordProductSale({ riderId: mockUser.id, productId: mockProd.id, quantity: 0 }),
        (err) => err.statusCode === 400 && err.message.includes("quantity")
      );

      await assert.rejects(
        async () => service.recordProductSale({ riderId: mockUser.id, productId: mockProd.id, quantity: -5 }),
        (err) => err.statusCode === 400
      );
    });

    it("harus menolak kuantitas non-integer atau melebihi batas wajar", async () => {
      await assert.rejects(
        async () => service.recordProductSale({ riderId: mockUser.id, productId: mockProd.id, quantity: 2.5 }),
        (err) => err.statusCode === 400
      );

      await assert.rejects(
        async () => service.recordProductSale({ riderId: mockUser.id, productId: mockProd.id, quantity: 10001 }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("2. Product Availability & Price Snapshotting", () => {
    it("harus menolak produk yang tidak ditemukan atau tidak aktif", async () => {
      await assert.rejects(
        async () => service.recordProductSale({ riderId: mockUser.id, productId: "prod-invalid", quantity: 1 }),
        (err) => err.statusCode === 404
      );
    });
  });
});
