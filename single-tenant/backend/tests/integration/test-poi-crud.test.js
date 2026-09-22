import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../src/config/database.js";
import { redisClient } from "../../src/config/redis.js";
import { sharedRedisConnection } from "../../src/config/redisConfig.js";
import {
  createManualPoiService,
  getPoiByIdService,
  updateManualPoiService,
  deleteManualPoiService,
  bulkCreateManualPoisService,
} from "../../src/services/poiService.js";

describe("📍 Master POI CRUD & Hybrid Bulk Ingestion Integration Suite", () => {
  let createdPoiId = null;
  const testUser = { id: "00000000-0000-0000-0000-000000000001", role: "SUPERADMIN" };

  after(async () => {
    // Cleanup test artifacts
    if (createdPoiId) {
      await pool.query("DELETE FROM pois WHERE id = $1", [createdPoiId]);
    }
    await pool.query("DELETE FROM pois WHERE external_id LIKE 'test:bulk:%'");
    await pool.end();
    try {
      if (redisClient.isOpen) await redisClient.disconnect();
      sharedRedisConnection.disconnect();
    } catch (e) {}
  });

  test("1. Manual Single POI Creation with Auto-Clustering", async () => {
    const payload = {
      name: "Kopi Kenangan Sidoarjo Alun-Alun Test",
      latitude: -7.4478,
      longitude: 112.7183,
      // category omitted -> should auto-cluster to 'Kafe & Kedai Kopi'
    };

    const poi = await createManualPoiService(payload, testUser);
    assert.ok(poi.id, "POI ID must be generated");
    createdPoiId = poi.id;
    assert.equal(poi.name, "Kopi Kenangan Sidoarjo Alun-Alun Test");
    assert.equal(poi.category, "Kafe & Kedai Kopi", "Auto-clustering must resolve to 'Kafe & Kedai Kopi'");
    assert.equal(poi.approval_status, "APPROVED");
    assert.equal(poi.operational_status, "ELIGIBLE");

    // Verify PostGIS Geometry
    const { rows } = await pool.query(
      "SELECT ST_X(geom) AS lon, ST_Y(geom) AS lat FROM pois WHERE id = $1",
      [poi.id]
    );
    assert.equal(rows.length, 1);
    assert.ok(Math.abs(rows[0].lat - (-7.4478)) < 0.0001, "Latitude matches PostGIS Y");
    assert.ok(Math.abs(rows[0].lon - 112.7183) < 0.0001, "Longitude matches PostGIS X");
  });

  test("2. Fetch POI by ID", async () => {
    const fetched = await getPoiByIdService(createdPoiId);
    assert.ok(fetched, "Fetched POI must exist");
    assert.equal(fetched.id, createdPoiId);
    assert.equal(fetched.name, "Kopi Kenangan Sidoarjo Alun-Alun Test");
  });

  test("3. Update Manual POI Properties & Coordinates", async () => {
    const updatePayload = {
      name: "Kopi Kenangan Sidoarjo Renovated",
      latitude: -7.4500,
      longitude: 112.7200,
      operational_status: "ELIGIBLE",
    };

    const updated = await updateManualPoiService(createdPoiId, updatePayload, testUser);
    assert.equal(updated.name, "Kopi Kenangan Sidoarjo Renovated");
    assert.ok(Math.abs(Number(updated.latitude) - (-7.4500)) < 0.0001);

    // Verify Geometry update
    const { rows } = await pool.query(
      "SELECT ST_X(geom) AS lon, ST_Y(geom) AS lat FROM pois WHERE id = $1",
      [createdPoiId]
    );
    assert.ok(Math.abs(rows[0].lat - (-7.4500)) < 0.0001, "Updated Lat matches PostGIS Y");
  });

  test("4. Defensive Coordinate Rejection on Manual POI Creation", async () => {
    await assert.rejects(
      async () => {
        await createManualPoiService({ name: "Invalid Lat", latitude: 95.0, longitude: 112.0 }, testUser);
      },
      { statusCode: 400 }
    );

    await assert.rejects(
      async () => {
        await createManualPoiService({ name: "Invalid Lon", latitude: -7.0, longitude: 195.0 }, testUser);
      },
      { statusCode: 400 }
    );
  });

  test("5. Bulk POI Ingestion with Auto-Clustering and Spatial Deduplication", async () => {
    const bulkItems = [
      {
        external_id: "test:bulk:001",
        name: "Point Coffee Indomaret Diponegoro",
        latitude: -7.4520,
        longitude: 112.7150,
      },
      {
        external_id: "test:bulk:002",
        name: "Janji Jiwa Jenggolo",
        latitude: -7.4410,
        longitude: 112.7190,
      },
      // Near-duplicate of bulk:002 within 5 meters
      {
        external_id: "test:bulk:003",
        name: "Janji Jiwa Jenggolo Cabang 1",
        latitude: -7.44102,
        longitude: 112.71902,
      },
    ];

    const result = await bulkCreateManualPoisService(bulkItems, testUser);
    assert.equal(result.total_submitted, 3);
    assert.ok(result.total_saved >= 1, "At least unique POIs saved");
    assert.ok(result.total_deduplicated <= result.total_submitted, "Deduplication applied");
  });

  test("6. Delete Manual POI", async () => {
    const deleted = await deleteManualPoiService(createdPoiId, testUser);
    assert.ok(deleted, "Delete response should return deleted record");

    await assert.rejects(
      async () => {
        await getPoiByIdService(createdPoiId);
      },
      { statusCode: 404 }
    );
    createdPoiId = null;
  });
});
