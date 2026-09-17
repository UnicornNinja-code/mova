/*
 * SpatialDeduplicator.js
 * 3-Level POI Deduplication Engine (Source Identity, PostGIS Spatial Candidate, & Semantic Matching)
 */

import { calculateStringSimilarity } from "../../utils/stringSimilarity.js";

const EARTH_RADIUS_METERS = 6371000;
const POI_SPATIAL_CANDIDATE_METERS = 3;
const POI_SEMANTIC_MATCH_METERS = 15;
const POI_NAME_SIMILARITY_THRESHOLD = 0.85;

export class SpatialDeduplicator {
  static instance = null;

  constructor() {
    if (SpatialDeduplicator.instance) {
      return SpatialDeduplicator.instance;
    }
    SpatialDeduplicator.instance = this;
  }

  static getInstance() {
    if (!SpatialDeduplicator.instance) {
      SpatialDeduplicator.instance = new SpatialDeduplicator();
    }
    return SpatialDeduplicator.instance;
  }

  /**
   * Calculates Haversine distance in meters between two coordinates (Utility Helper)
   */
  calculateHaversineDistanceMeter(lat1, lon1, lat2, lon2) {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  /**
   * Executes 3-Level PostGIS Database Deduplication Engine inside SQL Transaction
   */
  async processDatabaseDeduplication(client) {
    // STEP 1: Spatial Candidate Query (ST_DWithin up to 15m) using PostGIS GIST Index

    const spatialCandidatesQuery = `
      SELECT 
        p1.id AS id_a,
        p1.logical_poi_id AS logical_a,
        p1.duplicate_of AS dup_a,
        p1.created_at AS created_a,
        p1.name AS name_a,
        p1.operational_status AS status_a,
        p2.id AS id_b,
        p2.logical_poi_id AS logical_b,
        p2.duplicate_of AS dup_b,
        p2.created_at AS created_b,
        p2.name AS name_b,
        p2.operational_status AS status_b,
        p1.category,
        ST_Distance(p1.geom::geography, p2.geom::geography) AS distance_meters
      FROM pois p1
      JOIN pois p2 ON p1.category = p2.category AND p1.id < p2.id
      WHERE p1.operational_status <> 'EXCLUDED' AND p2.operational_status <> 'EXCLUDED'
        AND ST_DWithin(p1.geom::geography, p2.geom::geography, $1)
      ORDER BY ST_Distance(p1.geom::geography, p2.geom::geography) ASC;
    `;

    const { rows: pairs } = await client.query(spatialCandidatesQuery, [POI_SEMANTIC_MATCH_METERS]);

    const reviewIds = new Set();
    const duplicateUpdates = []; // { childId, parentId }

    for (const pair of pairs) {
      const dist = parseFloat(pair.distance_meters);
      const similarity = calculateStringSimilarity(pair.name_a, pair.name_b);

      // LEVEL 3: Confirmed Semantic Duplicate (Dist <= 15m AND Same Category AND Similarity >= 85%)
      if (dist <= POI_SEMANTIC_MATCH_METERS && similarity >= POI_NAME_SIMILARITY_THRESHOLD) {
        // Determine canonical parent deterministically (oldest record / smallest UUID fallback)
        let parentId, childId;
        const timeA = new Date(pair.created_a).getTime();
        const timeB = new Date(pair.created_b).getTime();

        if (timeA < timeB) {
          parentId = pair.id_a;
          childId = pair.id_b;
        } else if (timeB < timeA) {
          parentId = pair.id_b;
          childId = pair.id_a;
        } else {
          // UUID string fallback
          if (pair.id_a < pair.id_b) {
            parentId = pair.id_a;
            childId = pair.id_b;
          } else {
            parentId = pair.id_b;
            childId = pair.id_a;
          }
        }

        duplicateUpdates.push({ childId, parentId });
      } 
      // LEVEL 2: Potential Spatial Candidate (Dist <= 3m AND Same Category AND Similarity < 85%)
      else if (dist <= POI_SPATIAL_CANDIDATE_METERS) {
        reviewIds.add(pair.id_a);
        reviewIds.add(pair.id_b);
      }
    }

    // Process Level 3 Duplicate Linking with Transitive Cluster Convergence
    for (const update of duplicateUpdates) {
      // Resolve canonical root for parent
      const { rows: parentRows } = await client.query(
        "SELECT id, COALESCE(duplicate_of, id) AS root_id, logical_poi_id FROM pois WHERE id = $1;",
        [update.parentId]
      );
      if (parentRows.length === 0) continue;
      const rootId = parentRows[0].root_id;
      const canonicalLogicalId = parentRows[0].logical_poi_id || rootId;

      // Update child POI to link to canonical root
      await client.query(
        `
        UPDATE pois 
        SET 
          logical_poi_id = $1,
          duplicate_of = $2,
          operational_status = CASE 
            WHEN operational_status = 'EXCLUDED' THEN 'EXCLUDED' 
            ELSE 'ELIGIBLE' 
          END
        WHERE id = $3;
      `,
        [canonicalLogicalId, rootId, update.childId]
      );

      // Transitive cluster update: Update all descendants in child's previous cluster
      await client.query(
        `
        UPDATE pois 
        SET logical_poi_id = $1, duplicate_of = $2
        WHERE duplicate_of = $3;
      `,
        [canonicalLogicalId, rootId, update.childId]
      );

      // Ensure root parent remains root
      await client.query(
        "UPDATE pois SET duplicate_of = NULL WHERE id = $1;",
        [rootId]
      );

      // Remove child from review set if confirmed duplicate
      reviewIds.delete(update.childId);
    }

    // Process Level 2 REVIEW Status Assignment
    for (const reviewId of reviewIds) {
      await client.query(
        `
        UPDATE pois 
        SET operational_status = 'REVIEW'
        WHERE id = $1 AND duplicate_of IS NULL AND operational_status <> 'EXCLUDED';
      `,
        [reviewId]
      );
    }
  }

  /**
   * In-Memory Legacy Array Deduplicate Helper (Backward Compatibility)
   */
  deduplicate(transformedPois = [], thresholdMeter = 15) {
    const deduplicatedPois = [];
    const seenOsmIds = new Set();

    for (const currentPoi of transformedPois) {
      if (seenOsmIds.has(currentPoi.osm_id)) continue;

      const isSpatialDuplicate = deduplicatedPois.some((existingPoi) => {
        if (
          existingPoi.category === currentPoi.category &&
          calculateStringSimilarity(existingPoi.name, currentPoi.name) >= 0.85 &&
          !currentPoi.name.includes("(Tanpa Nama)")
        ) {
          const distMeter = this.calculateHaversineDistanceMeter(
            existingPoi.latitude,
            existingPoi.longitude,
            currentPoi.latitude,
            currentPoi.longitude
          );
          return distMeter <= thresholdMeter;
        }
        return false;
      });

      if (!isSpatialDuplicate) {
        seenOsmIds.add(currentPoi.osm_id);
        deduplicatedPois.push(currentPoi);
      }
    }

    return deduplicatedPois;
  }
}

export const spatialDeduplicator = SpatialDeduplicator.getInstance();
