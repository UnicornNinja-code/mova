/*
 * DatasetPromotionService.ts
 *
 * Atomic Promotion & Snapshot-Based Physical Rollback Engine for MOVA Spatial Datasets
 * Implements:
 * 1. Physical Dataset Reconciliation & Tombstoning (Orphan / Deleted features deactivated)
 * 2. Atomic Compare-and-Swap database transactions
 * 3. Snapshot-Verified Physical Rollback (Guaranteed state restoration from SHA-256 verified GeoJSON)
 * 4. Idempotency & Zero Partial States
 */

import { pool } from "../../config/database.js";
import { datasetVersionRepository } from "../../repositories/datasetVersionRepository.js";
import { spatialValidationService } from "./SpatialValidationService.js";
import { spatialSnapshotService } from "./SpatialSnapshotService.js";
import format from "pg-format";

export class DatasetPromotionService {
  private static instance: DatasetPromotionService | null = null;

  public static getInstance(): DatasetPromotionService {
    if (!DatasetPromotionService.instance) {
      DatasetPromotionService.instance = new DatasetPromotionService();
    }
    return DatasetPromotionService.instance;
  }

  /**
   * Promote a Staging dataset version to ACTIVE status via Atomic Transaction with Reconciliation
   * Enforces True Compare-and-Swap (CAS) with row-level locking (SELECT ... FOR UPDATE)
   */
  public async promoteVersion(
    versionId: string,
    expectedActiveVersionId?: string | null
  ): Promise<{ success: boolean; version: any; message: string }> {
    const versionRecord = await datasetVersionRepository.findById(versionId);
    if (!versionRecord) {
      throw new Error(`Dataset version ID '${versionId}' tidak ditemukan.`);
    }

    if (versionRecord.status === "ACTIVE") {
      return { success: true, version: versionRecord, message: "Versi ini sudah berstatus ACTIVE." };
    }

    const datasetType = versionRecord.dataset_type;
    const stagingTable = datasetType === "POI" ? "pois_staging" : "protocol_roads_staging";

    // 1. PostGIS Quality Gate Validation
    const validation = await spatialValidationService.validateStagingGeometries(stagingTable, versionId);
    if (!validation.valid) {
      await datasetVersionRepository.updateVersion(versionId, {
        status: "FAILED",
        error_message: `PostGIS Spatial Validation Gagal: Ditemukan ${validation.invalidCount} geometri tidak valid.`,
      });
      throw new Error(`Promosi dibatalkan: Ditemukan ${validation.invalidCount} geometri tidak valid pada staging.`);
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 2. Pessimistic row locking on current active version (SELECT ... FOR UPDATE)
      const { rows: activeRows } = await client.query(
        `SELECT id, version, status 
         FROM dataset_versions 
         WHERE dataset_type = $1 AND status = 'ACTIVE' 
         FOR UPDATE;`,
        [datasetType]
      );
      const activeVersion = activeRows[0] || null;

      // 3. True CAS Verification: Compare current ACTIVE against expectedActiveVersionId
      if (expectedActiveVersionId !== undefined) {
        const currentActiveId = activeVersion ? activeVersion.id : null;
        if (currentActiveId !== expectedActiveVersionId) {
          console.warn(
            `⚠️ [CONCURRENCY_CONFLICT] Promosi ditolak untuk versi ${versionRecord.version}. ` +
            `Expected ACTIVE: '${expectedActiveVersionId || "NONE"}', Found ACTIVE: '${currentActiveId || "NONE"}'.`
          );
          const conflictErr: any = new Error(
            `OPTIMISTIC_CONCURRENCY_CONFLICT: Versi aktif saat ini ('${currentActiveId || "NONE"}') ` +
            `tidak cocok dengan baseline yang diharapkan ('${expectedActiveVersionId || "NONE"}').`
          );
          conflictErr.code = "CONCURRENCY_CONFLICT";
          throw conflictErr;
        }
      }

      // 4. Demote currently active version to RETIRED
      if (activeVersion) {
        await client.query(
          "UPDATE dataset_versions SET status = 'RETIRED', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
          [activeVersion.id]
        );
      }

      // 4. Promote Staging data into Master Production Table & Reconcile Deleted Features
      if (datasetType === "POI") {
        // Step 4a: Upsert new and updated records from staging into production table
        const upsertPoiSql = `
          INSERT INTO pois (
            version_id, hub_id, external_id, osm_type, osm_id, logical_poi_id, name, category,
            latitude, longitude, geom, metadata, status, approval_status, operational_status, zone_id, is_clustered, is_active, updated_at
          )
          SELECT 
            s.version_id, s.hub_id, s.external_id, s.osm_type, s.osm_id, gen_random_uuid(), s.name, s.category,
            s.latitude, s.longitude, s.geom, s.metadata, 'APPROVED', 'APPROVED', 'ELIGIBLE', NULL, false, true, CURRENT_TIMESTAMP
          FROM pois_staging s
          WHERE s.version_id = $1 AND s.validation_status != 'INVALID'
          ON CONFLICT (external_id) DO UPDATE SET
            version_id = EXCLUDED.version_id,
            hub_id = COALESCE(EXCLUDED.hub_id, pois.hub_id),
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            geom = EXCLUDED.geom,
            metadata = EXCLUDED.metadata,
            status = 'APPROVED',
            approval_status = 'APPROVED',
            operational_status = 'ELIGIBLE',
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
        `;
        await client.query(upsertPoiSql, [versionId]);

        // Step 4b: Reconcile / Tombstone missing records (Orphan/Deleted features)
        const tombstonePoiSql = `
          UPDATE pois
          SET 
            is_active = false,
            status = 'INACTIVE',
            operational_status = 'RETIRED',
            updated_at = CURRENT_TIMESTAMP
          WHERE external_id NOT IN (
            SELECT external_id FROM pois_staging WHERE version_id = $1 AND validation_status != 'INVALID'
          )
          AND (is_active = true OR operational_status = 'ELIGIBLE' OR status = 'APPROVED');
        `;
        const tombstoneRes = await client.query(tombstonePoiSql, [versionId]);
        if (tombstoneRes.rowCount && tombstoneRes.rowCount > 0) {
          console.log(`🧹 [RECONCILIATION:POI] ${tombstoneRes.rowCount} POI kadaluarsa/terhapus di-retire secara aman.`);
        }
      } else if (datasetType === "TOLL_ROADS") {
        // Step 4a: Upsert toll roads from staging
        const upsertRoadSql = `
          INSERT INTO protocol_roads (
            version_id, external_id, name, highway_type, restriction_type, geom, metadata, is_active, updated_at
          )
          SELECT 
            s.version_id, s.external_id, s.name, s.highway_type, s.restriction_type, s.geom, s.metadata, true, CURRENT_TIMESTAMP
          FROM protocol_roads_staging s
          WHERE s.version_id = $1 AND s.validation_status != 'INVALID'
          ON CONFLICT (external_id) DO UPDATE SET
            version_id = EXCLUDED.version_id,
            name = EXCLUDED.name,
            highway_type = EXCLUDED.highway_type,
            restriction_type = EXCLUDED.restriction_type,
            geom = EXCLUDED.geom,
            metadata = EXCLUDED.metadata,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
        `;
        await client.query(upsertRoadSql, [versionId]);

        // Step 4b: Tombstone toll road records not present in this version
        const tombstoneTollSql = `
          UPDATE protocol_roads
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
            AND external_id NOT IN (
              SELECT external_id FROM protocol_roads_staging WHERE version_id = $1 AND validation_status != 'INVALID'
            )
            AND is_active = true;
        `;
        const tombstoneRes = await client.query(tombstoneTollSql, [versionId]);
        if (tombstoneRes.rowCount && tombstoneRes.rowCount > 0) {
          console.log(`🧹 [RECONCILIATION:TOLL] ${tombstoneRes.rowCount} ruas jalan tol kadaluarsa di-nonaktifkan.`);
        }
      } else if (datasetType === "PROTOCOL_ROADS") {
        // Step 4a: Upsert protocol roads from staging
        const upsertRoadSql = `
          INSERT INTO protocol_roads (
            version_id, external_id, name, highway_type, restriction_type, geom, metadata, is_active, updated_at
          )
          SELECT 
            s.version_id, s.external_id, s.name, s.highway_type, s.restriction_type, s.geom, s.metadata, true, CURRENT_TIMESTAMP
          FROM protocol_roads_staging s
          WHERE s.version_id = $1 AND s.validation_status != 'INVALID'
          ON CONFLICT (external_id) DO UPDATE SET
            version_id = EXCLUDED.version_id,
            name = EXCLUDED.name,
            highway_type = EXCLUDED.highway_type,
            restriction_type = EXCLUDED.restriction_type,
            geom = EXCLUDED.geom,
            metadata = EXCLUDED.metadata,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP;
        `;
        await client.query(upsertRoadSql, [versionId]);

        // Step 4b: Tombstone protocol road records not present in this version
        const tombstoneProtoSql = `
          UPDATE protocol_roads
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE (restriction_type = 'PROHIBITED_ROAD' OR restriction_type IS NULL)
            AND external_id NOT IN (
              SELECT external_id FROM protocol_roads_staging WHERE version_id = $1 AND validation_status != 'INVALID'
            )
            AND is_active = true;
        `;
        const tombstoneRes = await client.query(tombstoneProtoSql, [versionId]);
        if (tombstoneRes.rowCount && tombstoneRes.rowCount > 0) {
          console.log(`🧹 [RECONCILIATION:PROTOCOL] ${tombstoneRes.rowCount} ruas jalan protokol kadaluarsa di-nonaktifkan.`);
        }
      }

      // 5. Mark new version as ACTIVE
      const { rows: updatedRows } = await client.query(
        `UPDATE dataset_versions
         SET status = 'ACTIVE', promoted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *;`,
        [versionId]
      );

      await client.query("COMMIT");

      console.log(`🚀 [PROMOTION SERVICE] Dataset '${datasetType}' Version ${versionRecord.version} berhasil dipromosikan ke ACTIVE!`);

      // 6. Enforce Retention Policy (Clean up staging records older than 5 versions)
      this.enforceRetentionPolicy(datasetType).catch((err) => {
        console.warn("⚠️ [PROMOTION SERVICE] Warning during retention cleanup:", err.message);
      });

      return {
        success: true,
        version: updatedRows[0],
        message: `Dataset ${datasetType} Version ${versionRecord.version} berhasil dipromosikan menjadi ACTIVE.`,
      };
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error(`💥 [PROMOTION SERVICE] Rollback promotion for version ${versionId}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Snapshot-Verified Physical Rollback to a historical RETIRED version
   * Restores physical data directly from the SHA-256 validated GeoJSON snapshot
   */
  public async rollbackToVersion(targetVersionId: string): Promise<{ success: boolean; version: any; message: string }> {
    const targetVersion = await datasetVersionRepository.findById(targetVersionId);
    if (!targetVersion) {
      throw new Error(`Target rollback version ID '${targetVersionId}' tidak ditemukan.`);
    }

    // 1. Idempotency Guard: If already active, return immediately without mutation
    if (targetVersion.status === "ACTIVE") {
      return {
        success: true,
        version: targetVersion,
        message: `Versi ${targetVersion.version} sudah berstatus ACTIVE (Idempotent).`,
      };
    }

    const datasetType = targetVersion.dataset_type;

    // 2. Locate & Verify Snapshot File Integrity (SHA-256 Checksum Verification)
    const verification = await spatialSnapshotService.verifySnapshotIntegrity(
      datasetType,
      targetVersion.version,
      targetVersion.checksum
    );

    if (!verification.valid) {
      throw new Error(`Gagal Rollback: ${verification.error}`);
    }

    const features: any[] = verification.featureCollection?.features || [];
    const activeExternalIds = features
      .map((f: any) => f.properties?.id || f.properties?.external_id)
      .filter((id: any): id is string => typeof id === "string" && id.trim().length > 0);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 3. Demote currently active version to RETIRED
      const activeVersion = await datasetVersionRepository.findActiveVersion(datasetType);
      if (activeVersion) {
        await client.query(
          "UPDATE dataset_versions SET status = 'RETIRED', updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
          [activeVersion.id]
        );
      }

      // 4. Physical Dataset Reconciliation based on the verified Snapshot
      if (datasetType === "POI") {
        if (features.length > 0) {
          const poiValues = features.map((f: any) => [
            targetVersion.id,
            f.properties?.id || `mova:poi:v${targetVersion.version}`,
            f.properties?.osm_type || null,
            f.properties?.osm_id || null,
            f.properties?.name || "Titik POI",
            f.properties?.category || "Lainnya",
            f.geometry.coordinates[1],
            f.geometry.coordinates[0],
            JSON.stringify(f.geometry),
            JSON.stringify(f.properties?.metadata || {}),
          ]);

          const batchSize = 200;
          for (let i = 0; i < poiValues.length; i += batchSize) {
            const batch = poiValues.slice(i, i + batchSize);
            const restorePoiSql = format(
              `
              INSERT INTO pois (
                version_id, external_id, osm_type, osm_id, logical_poi_id, name, category,
                latitude, longitude, geom, metadata, status, approval_status, operational_status, is_active, updated_at
              )
              SELECT 
                v.version_id::uuid, v.external_id, v.osm_type, v.osm_id::bigint, gen_random_uuid(), v.name, v.category,
                v.latitude::double precision, v.longitude::double precision,
                ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326),
                v.metadata::jsonb, 'APPROVED', 'APPROVED', 'ELIGIBLE', true, CURRENT_TIMESTAMP
              FROM (VALUES %L) AS v(version_id, external_id, osm_type, osm_id, name, category, latitude, longitude, geojson, metadata)
              ON CONFLICT (external_id) DO UPDATE SET
                version_id = EXCLUDED.version_id,
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                geom = EXCLUDED.geom,
                metadata = EXCLUDED.metadata,
                status = 'APPROVED',
                approval_status = 'APPROVED',
                operational_status = 'ELIGIBLE',
                is_active = true,
                updated_at = CURRENT_TIMESTAMP;
            `,
              batch
            );
            await client.query(restorePoiSql);
          }
        }

        // Deactivate all POIs not belonging to this snapshot
        if (activeExternalIds.length > 0) {
          await client.query(
            `
            UPDATE pois
            SET is_active = false, status = 'INACTIVE', operational_status = 'RETIRED', updated_at = CURRENT_TIMESTAMP
            WHERE external_id != ALL($1::varchar[])
              AND (is_active = true OR operational_status = 'ELIGIBLE' OR status = 'APPROVED');
          `,
            [activeExternalIds]
          );
        } else {
          await client.query(`
            UPDATE pois
            SET is_active = false, status = 'INACTIVE', operational_status = 'RETIRED', updated_at = CURRENT_TIMESTAMP
            WHERE is_active = true OR operational_status = 'ELIGIBLE';
          `);
        }
      } else if (datasetType === "TOLL_ROADS") {
        if (features.length > 0) {
          const roadValues = features.map((f: any) => [
            targetVersion.id,
            f.properties?.id || `mova:way:v${targetVersion.version}`,
            f.properties?.name || "Jalan Tol",
            f.properties?.highway || "motorway",
            "PROHIBITED_TOLL_ROAD",
            JSON.stringify(f.geometry),
            JSON.stringify(f.properties?.metadata || {}),
          ]);

          const restoreRoadSql = format(
            `
            INSERT INTO protocol_roads (
              version_id, external_id, name, highway_type, restriction_type, geom, metadata, is_active, updated_at
            )
            SELECT 
              v.version_id::uuid, v.external_id, v.name, v.highway_type, v.restriction_type,
              ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326),
              v.metadata::jsonb, true, CURRENT_TIMESTAMP
            FROM (VALUES %L) AS v(version_id, external_id, name, highway_type, restriction_type, geojson, metadata)
            ON CONFLICT (external_id) DO UPDATE SET
              version_id = EXCLUDED.version_id,
              name = EXCLUDED.name,
              highway_type = EXCLUDED.highway_type,
              restriction_type = EXCLUDED.restriction_type,
              geom = EXCLUDED.geom,
              metadata = EXCLUDED.metadata,
              is_active = true,
              updated_at = CURRENT_TIMESTAMP;
          `,
            roadValues
          );
          await client.query(restoreRoadSql);
        }

        // Deactivate all toll roads not belonging to this snapshot
        if (activeExternalIds.length > 0) {
          await client.query(
            `
            UPDATE protocol_roads
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE restriction_type = 'PROHIBITED_TOLL_ROAD'
              AND external_id != ALL($1::varchar[])
              AND is_active = true;
          `,
            [activeExternalIds]
          );
        } else {
          await client.query(`
            UPDATE protocol_roads
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE restriction_type = 'PROHIBITED_TOLL_ROAD' AND is_active = true;
          `);
        }
      } else if (datasetType === "PROTOCOL_ROADS") {
        if (features.length > 0) {
          const roadValues = features.map((f: any) => [
            targetVersion.id,
            f.properties?.id || `mova:way:v${targetVersion.version}`,
            f.properties?.name || "Jalan Protokol",
            f.properties?.highway || "secondary",
            "PROHIBITED_ROAD",
            JSON.stringify(f.geometry),
            JSON.stringify(f.properties?.metadata || {}),
          ]);

          const restoreProtoSql = format(
            `
            INSERT INTO protocol_roads (
              version_id, external_id, name, highway_type, restriction_type, geom, metadata, is_active, updated_at
            )
            SELECT 
              v.version_id::uuid, v.external_id, v.name, v.highway_type, v.restriction_type,
              ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326),
              v.metadata::jsonb, true, CURRENT_TIMESTAMP
            FROM (VALUES %L) AS v(version_id, external_id, name, highway_type, restriction_type, geojson, metadata)
            ON CONFLICT (external_id) DO UPDATE SET
              version_id = EXCLUDED.version_id,
              name = EXCLUDED.name,
              highway_type = EXCLUDED.highway_type,
              restriction_type = EXCLUDED.restriction_type,
              geom = EXCLUDED.geom,
              metadata = EXCLUDED.metadata,
              is_active = true,
              updated_at = CURRENT_TIMESTAMP;
          `,
            roadValues
          );
          await client.query(restoreProtoSql);
        }

        if (activeExternalIds.length > 0) {
          await client.query(
            `
            UPDATE protocol_roads
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE (restriction_type = 'PROHIBITED_ROAD' OR restriction_type IS NULL)
              AND external_id != ALL($1::varchar[])
              AND is_active = true;
          `,
            [activeExternalIds]
          );
        }
      }

      // 5. Promote target version to ACTIVE in dataset_versions
      const { rows } = await client.query(
        `UPDATE dataset_versions
         SET status = 'ACTIVE', promoted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *;`,
        [targetVersionId]
      );

      await client.query("COMMIT");

      console.log(`⏪ [PROMOTION SERVICE] Rollback fisik '${datasetType}' sukses kembali ke Version ${targetVersion.version} (${features.length} fitur dipulihkan).`);
      return {
        success: true,
        version: rows[0],
        message: `Berhasil rollback fisik dataset ${datasetType} ke Version ${targetVersion.version} (${features.length} fitur dipulihkan dari snapshot).`,
      };
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Enforce retention policy: Purge staging rows for versions beyond 5 most recent
   */
  public async enforceRetentionPolicy(datasetType: string, keepCount: number = 5): Promise<void> {
    const query = `
      SELECT id, version FROM dataset_versions
      WHERE dataset_type = $1
      ORDER BY version DESC
      OFFSET $2;
    `;
    const { rows } = await pool.query(query, [datasetType, keepCount]);
    if (rows.length > 0) {
      const oldVersionIds = rows.map((r: any) => r.id);
      const stagingTable = datasetType === "POI" ? "pois_staging" : "protocol_roads_staging";
      await pool.query(
        `DELETE FROM ${stagingTable} WHERE version_id = ANY($1::uuid[]);`,
        [oldVersionIds]
      );
      console.log(`🧹 [RETENTION POLICY] Membersihkan data staging lama untuk ${oldVersionIds.length} versi di ${stagingTable}.`);
    }
  }
}

export const datasetPromotionService = DatasetPromotionService.getInstance();
