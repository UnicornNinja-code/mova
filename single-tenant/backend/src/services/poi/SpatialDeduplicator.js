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
   * Calculates completeness score for deterministic canonical selection
   * Non-generic name (+10), Non-fallback category (+5)
   */
  calculateCompletenessScore(poi) {
    let score = 0;
    const name = poi.name || "";
    if (name && !name.includes("(Tanpa Nama)")) {
      score += 10;
    }
    if (poi.category && poi.category !== "Lainnya") {
      score += 5;
    }
    return score;
  }

  /**
   * Executes 3-Level PostGIS Database Deduplication Engine inside SQL Transaction
   */
  async processDatabaseDeduplication(client) {
    // STEP 1: Spatial Candidate Query (ST_DWithin up to 25m envelope) using PostGIS GIST Index
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
    const confirmedPairs = []; // [id_a, id_b]
    const poiMap = new Map(); // id -> poi data

    for (const pair of pairs) {
      const dist = parseFloat(pair.distance_meters);
      const similarity = calculateStringSimilarity(pair.name_a, pair.name_b);

      poiMap.set(pair.id_a, {
        id: pair.id_a,
        name: pair.name_a,
        category: pair.category,
        created_at: pair.created_a,
        logical_poi_id: pair.logical_a,
        duplicate_of: pair.dup_a,
        operational_status: pair.status_a,
      });

      poiMap.set(pair.id_b, {
        id: pair.id_b,
        name: pair.name_b,
        category: pair.category,
        created_at: pair.created_b,
        logical_poi_id: pair.logical_b,
        duplicate_of: pair.dup_b,
        operational_status: pair.status_b,
      });

      // LEVEL 3: Confirmed Semantic Duplicate (Dist <= 15m AND Same Category AND Similarity >= 85%)
      if (dist <= POI_SEMANTIC_MATCH_METERS && similarity >= POI_NAME_SIMILARITY_THRESHOLD) {
        confirmedPairs.push([pair.id_a, pair.id_b]);
      } 
      // LEVEL 2: Potential Spatial Candidate (Dist <= 3m AND Same Category AND Similarity < 85%)
      else if (dist <= POI_SPATIAL_CANDIDATE_METERS) {
        reviewIds.add(pair.id_a);
        reviewIds.add(pair.id_b);
      }
    }

    // STEP 2: Build Connected Components (Graph of duplicate clusters)
    const adj = new Map();
    for (const [a, b] of confirmedPairs) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    }

    const visited = new Set();
    const clusters = [];

    for (const startId of adj.keys()) {
      if (visited.has(startId)) continue;
      const cluster = [];
      const queue = [startId];
      visited.add(startId);

      while (queue.length > 0) {
        const curr = queue.shift();
        cluster.push(poiMap.get(curr));
        for (const neighbor of adj.get(curr) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      clusters.push(cluster);
    }

    // STEP 3: Process Each Cluster with Deterministic Canonical Selection (completeness_score DESC, id ASC)
    for (const cluster of clusters) {
      cluster.sort((a, b) => {
        const scoreA = this.calculateCompletenessScore(a);
        const scoreB = this.calculateCompletenessScore(b);
        if (scoreB !== scoreA) {
          return scoreB - scoreA; // Highest completeness first
        }
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) {
          return timeA - timeB; // Oldest record first
        }
        return String(a.id).localeCompare(String(b.id)); // Deterministic UUID tie-breaker
      });

      const canonical = cluster[0];
      // Preserve existing logical_poi_id if available, fallback to canonical.id
      const canonicalLogicalId = canonical.logical_poi_id || cluster.find(p => p.logical_poi_id)?.logical_poi_id || canonical.id;

      // 1. Update Canonical POI (duplicate_of = NULL, preserve/assign canonical logical_poi_id)
      await client.query(
        `UPDATE pois 
         SET duplicate_of = NULL, 
             logical_poi_id = $1, 
             operational_status = CASE 
               WHEN operational_status = 'EXCLUDED' THEN 'EXCLUDED' 
               ELSE 'ELIGIBLE' 
             END
         WHERE id = $2;`,
        [canonicalLogicalId, canonical.id]
      );
      reviewIds.delete(canonical.id);

      // 2. Update Duplicate Child POIs (duplicate_of = canonical.id, logical_poi_id = canonicalLogicalId)
      for (let i = 1; i < cluster.length; i++) {
        const child = cluster[i];
        await client.query(
          `UPDATE pois 
           SET duplicate_of = $1, 
               logical_poi_id = $2, 
               operational_status = CASE 
                 WHEN operational_status = 'EXCLUDED' THEN 'EXCLUDED' 
                 ELSE 'ELIGIBLE' 
               END
           WHERE id = $3;`,
          [canonical.id, canonicalLogicalId, child.id]
        );
        reviewIds.delete(child.id);
      }
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
