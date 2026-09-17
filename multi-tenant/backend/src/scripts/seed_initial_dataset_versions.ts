/*
 * seed_initial_dataset_versions.ts
 *
 * Seed Baseline Initial Dataset Versions (Version 1: ACTIVE)
 * Links existing PostGIS pois and protocol_roads records to Version 1 and
 * writes baseline GeoJSON intermediate snapshots and manifests so that
 * the system is 100% version-aware and rollback-ready from Version 1 onward.
 */

import { pool } from "../config/database.js";
import { datasetVersionRepository } from "../repositories/datasetVersionRepository.js";
import { spatialSnapshotService } from "../services/spatial/SpatialSnapshotService.js";

async function runSeed() {
  console.log("🌱 [SEED] Memulai Inisialisasi Baseline Dataset Versions & Snapshots...");
  spatialSnapshotService.ensureDirectoryTree();

  // 1. Baseline POI Version 1
  const activePoiVersion = await datasetVersionRepository.findActiveVersion("POI");
  const poiCountRes = await pool.query("SELECT COUNT(*)::int AS count FROM pois;");
  const poiCount = poiCountRes.rows[0]?.count || 0;

  const { rows: rawPois } = await pool.query(`
    SELECT external_id, name, category, latitude, longitude, ST_AsGeoJSON(geom)::json AS geom, metadata
    FROM pois
    WHERE is_active = true OR is_active IS NULL;
  `);

  const poiFc = {
    type: "FeatureCollection",
    features: rawPois.map((p: any) => ({
      type: "Feature",
      geometry: p.geom || { type: "Point", coordinates: [p.longitude, p.latitude] },
      properties: { id: p.external_id, name: p.name, category: p.category, metadata: p.metadata },
    })),
  };

  const { filePath: poiSnapPath, checksum: poiChecksum } = await spatialSnapshotService.saveGeoJsonSnapshot("poi", 1, poiFc);
  const poiManifestPath = await spatialSnapshotService.saveManifest("poi", 1, {
    dataset: "poi",
    version: 1,
    source: "INITIAL_DATABASE_BASELINE",
    fetched_at: new Date().toISOString(),
    feature_count: poiFc.features.length,
    checksum_sha256: poiChecksum,
    validation_status: "VALIDATED",
    status: "ACTIVE",
  });

  if (!activePoiVersion) {
    const v1Poi = await datasetVersionRepository.createVersion({
      dataset_type: "POI",
      version: 1,
      status: "ACTIVE",
      source: "INITIAL_DATABASE_BASELINE",
      feature_count: poiCount,
      checksum: poiChecksum,
      snapshot_path: poiSnapPath,
      manifest_path: poiManifestPath,
      validation_summary: {
        baseline_seeded: true,
        features_count: poiCount,
        promoted_at: new Date().toISOString(),
      },
    });

    await datasetVersionRepository.updateVersion(v1Poi.id, {
      promoted_at: new Date(),
      validated_at: new Date(),
    });

    await pool.query("UPDATE pois SET version_id = $1 WHERE version_id IS NULL;", [v1Poi.id]);
    console.log(`✅ [POI] Baseline Version 1 (ACTIVE) berhasil dibuat dengan ${poiCount} POI.`);
  } else {
    await datasetVersionRepository.updateVersion(activePoiVersion.id, {
      checksum: poiChecksum,
      snapshot_path: poiSnapPath,
      manifest_path: poiManifestPath,
      feature_count: poiFc.features.length,
    });
    console.log(`ℹ️ [POI] Versi 1 diperbarui dengan snapshot & checksum (${poiFc.features.length} POI).`);
  }

  // 2. Baseline PROTOCOL_ROADS Version 1
  const activeProtocolRoads = await datasetVersionRepository.findActiveVersion("PROTOCOL_ROADS");
  const roadCountRes = await pool.query(
    "SELECT COUNT(*)::int AS count FROM protocol_roads WHERE restriction_type = 'PROHIBITED_ROAD' OR restriction_type IS NULL;"
  );
  const roadCount = roadCountRes.rows[0]?.count || 0;

  const { rows: rawProtoRoads } = await pool.query(`
    SELECT external_id, name, highway_type, restriction_type, ST_AsGeoJSON(geom)::json AS geom, metadata
    FROM protocol_roads
    WHERE (restriction_type = 'PROHIBITED_ROAD' OR restriction_type IS NULL)
      AND (is_active = true OR is_active IS NULL);
  `);

  const protoFc = {
    type: "FeatureCollection",
    features: rawProtoRoads.map((r: any) => ({
      type: "Feature",
      geometry: r.geom,
      properties: { id: r.external_id, name: r.name, highway: r.highway_type, restriction_type: r.restriction_type || "PROHIBITED_ROAD", metadata: r.metadata },
    })),
  };

  const { filePath: protoSnapPath, checksum: protoChecksum } = await spatialSnapshotService.saveGeoJsonSnapshot("protocol_roads", 1, protoFc);
  const protoManifestPath = await spatialSnapshotService.saveManifest("protocol_roads", 1, {
    dataset: "protocol_roads",
    version: 1,
    source: "INITIAL_DATABASE_BASELINE",
    fetched_at: new Date().toISOString(),
    feature_count: protoFc.features.length,
    checksum_sha256: protoChecksum,
    validation_status: "VALIDATED",
    status: "ACTIVE",
  });

  if (!activeProtocolRoads) {
    const v1Road = await datasetVersionRepository.createVersion({
      dataset_type: "PROTOCOL_ROADS",
      version: 1,
      status: "ACTIVE",
      source: "INITIAL_DATABASE_BASELINE",
      feature_count: roadCount,
      checksum: protoChecksum,
      snapshot_path: protoSnapPath,
      manifest_path: protoManifestPath,
      validation_summary: {
        baseline_seeded: true,
        features_count: roadCount,
        promoted_at: new Date().toISOString(),
      },
    });

    await datasetVersionRepository.updateVersion(v1Road.id, {
      promoted_at: new Date(),
      validated_at: new Date(),
    });

    await pool.query(
      "UPDATE protocol_roads SET version_id = $1 WHERE (restriction_type = 'PROHIBITED_ROAD' OR restriction_type IS NULL) AND version_id IS NULL;",
      [v1Road.id]
    );
    console.log(`✅ [PROTOCOL_ROADS] Baseline Version 1 (ACTIVE) berhasil dibuat dengan ${roadCount} segmen.`);
  } else {
    await datasetVersionRepository.updateVersion(activeProtocolRoads.id, {
      checksum: protoChecksum,
      snapshot_path: protoSnapPath,
      manifest_path: protoManifestPath,
      feature_count: protoFc.features.length,
    });
    console.log(`ℹ️ [PROTOCOL_ROADS] Versi 1 diperbarui dengan snapshot & checksum (${protoFc.features.length} segmen).`);
  }

  // 3. Baseline TOLL_ROADS Version 1
  const activeTollRoads = await datasetVersionRepository.findActiveVersion("TOLL_ROADS");
  const tollCountRes = await pool.query(
    "SELECT COUNT(*)::int AS count FROM protocol_roads WHERE restriction_type = 'PROHIBITED_TOLL_ROAD';"
  );
  const tollCount = tollCountRes.rows[0]?.count || 0;

  const { rows: rawTollRoads } = await pool.query(`
    SELECT external_id, name, highway_type, restriction_type, ST_AsGeoJSON(geom)::json AS geom, metadata
    FROM protocol_roads
    WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
      AND (is_active = true OR is_active IS NULL);
  `);

  const tollFc = {
    type: "FeatureCollection",
    features: rawTollRoads.map((r: any) => ({
      type: "Feature",
      geometry: r.geom,
      properties: { id: r.external_id, name: r.name, highway: r.highway_type, restriction_type: "PROHIBITED_TOLL_ROAD", metadata: r.metadata },
    })),
  };

  const { filePath: tollSnapPath, checksum: tollChecksum } = await spatialSnapshotService.saveGeoJsonSnapshot("toll_roads", 1, tollFc);
  const tollManifestPath = await spatialSnapshotService.saveManifest("toll_roads", 1, {
    dataset: "toll_roads",
    version: 1,
    source: "INITIAL_DATABASE_BASELINE",
    fetched_at: new Date().toISOString(),
    feature_count: tollFc.features.length,
    checksum_sha256: tollChecksum,
    validation_status: "VALIDATED",
    status: "ACTIVE",
  });

  if (!activeTollRoads) {
    const v1Toll = await datasetVersionRepository.createVersion({
      dataset_type: "TOLL_ROADS",
      version: 1,
      status: "ACTIVE",
      source: "INITIAL_DATABASE_BASELINE",
      feature_count: tollCount,
      checksum: tollChecksum,
      snapshot_path: tollSnapPath,
      manifest_path: tollManifestPath,
      validation_summary: {
        baseline_seeded: true,
        features_count: tollCount,
        promoted_at: new Date().toISOString(),
      },
    });

    await datasetVersionRepository.updateVersion(v1Toll.id, {
      promoted_at: new Date(),
      validated_at: new Date(),
    });

    await pool.query(
      "UPDATE protocol_roads SET version_id = $1 WHERE restriction_type = 'PROHIBITED_TOLL_ROAD' AND version_id IS NULL;",
      [v1Toll.id]
    );
    console.log(`✅ [TOLL_ROADS] Baseline Version 1 (ACTIVE) berhasil dibuat dengan ${tollCount} segmen jalan tol.`);
  } else {
    await datasetVersionRepository.updateVersion(activeTollRoads.id, {
      checksum: tollChecksum,
      snapshot_path: tollSnapPath,
      manifest_path: tollManifestPath,
      feature_count: tollFc.features.length,
    });
    console.log(`ℹ️ [TOLL_ROADS] Versi 1 diperbarui dengan snapshot & checksum (${tollFc.features.length} segmen).`);
  }

  console.log("🎉 [SEED] Inisialisasi Baseline Dataset Versioning & Snapshots Selesai dengan Sukses!\n");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("💥 Gagal seeding baseline versioning:", err);
  process.exit(1);
});
