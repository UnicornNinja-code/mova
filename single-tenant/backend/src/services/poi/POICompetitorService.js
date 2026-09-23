/*
 * POICompetitorService.js
 * Service Orchestrator for DSS Criteria C6 (Competitor Pressure - Cost Evaluation)
 * Complies with Competitor Acquisition & C6 Evaluation Contract v1.0 (ADR-01..ADR-04)
 */

import { pool } from "../../config/database.js";
import { ZoneModel } from "../../models/zoneModel.js";
import { competitorRepository } from "../../repositories/competitorRepository.js";
import { calculateStringSimilarity } from "../../utils/stringSimilarity.js";
import {
  operationalScope,
  assertWithinOperationalScope,
} from "../../config/operationalScope.js";

const VALID_CATEGORIES = ["DIRECT_STARLING", "LOW_PRICE_TAKEAWAY", "INDIRECT_PREMIUM"];
const CATEGORY_DEFAULT_WEIGHTS = {
  DIRECT_STARLING: 3,
  LOW_PRICE_TAKEAWAY: 2,
  INDIRECT_PREMIUM: 1,
};
const SIDOARJO_REGIONAL_BOUNDS = operationalScope.bbox;
const CANDIDATE_PROXIMITY_METERS = 15;
const CANDIDATE_SIMILARITY_THRESHOLD = 0.85;


/**
 * Validates competitor input against Contract v1.0 invariants
 */
export function validateCompetitorInput(data) {
  if (!data || typeof data !== "object") {
    const error = new Error("Data kompetitor survei harus berupa objek valid.");
    error.statusCode = 400;
    throw error;
  }

  if (!data.zone_id || typeof data.zone_id !== "string" || data.zone_id.trim() === "") {
    const error = new Error("Parameter 'zone_id' wajib diisi.");
    error.statusCode = 400;
    throw error;
  }

  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    const error = new Error("Parameter 'name' wajib diisi.");
    error.statusCode = 400;
    throw error;
  }

  // Validate latitude
  if (data.latitude === null || data.latitude === undefined || data.latitude === "") {
    const error = new Error("Parameter 'latitude' wajib diisi.");
    error.statusCode = 400;
    throw error;
  }
  const latNum = Number(data.latitude);
  if (Number.isNaN(latNum)) {
    const error = new Error("Nilai 'latitude' harus berupa angka numerik valid.");
    error.statusCode = 400;
    throw error;
  }
  if (latNum < SIDOARJO_REGIONAL_BOUNDS.minLat || latNum > SIDOARJO_REGIONAL_BOUNDS.maxLat) {
    const error = new Error(
      `Koordinat latitude (${latNum}) berada di luar batas otoritatif Sidoarjo [${SIDOARJO_REGIONAL_BOUNDS.minLat}, ${SIDOARJO_REGIONAL_BOUNDS.maxLat}].`
    );
    error.statusCode = 400;
    throw error;
  }

  // Validate longitude
  if (data.longitude === null || data.longitude === undefined || data.longitude === "") {
    const error = new Error("Parameter 'longitude' wajib diisi.");
    error.statusCode = 400;
    throw error;
  }
  const lonNum = Number(data.longitude);
  if (Number.isNaN(lonNum)) {
    const error = new Error("Nilai 'longitude' harus berupa angka numerik valid.");
    error.statusCode = 400;
    throw error;
  }
  if (lonNum < SIDOARJO_REGIONAL_BOUNDS.minLon || lonNum > SIDOARJO_REGIONAL_BOUNDS.maxLon) {
    const error = new Error(
      `Koordinat longitude (${lonNum}) berada di luar batas otoritatif Sidoarjo [${SIDOARJO_REGIONAL_BOUNDS.minLon}, ${SIDOARJO_REGIONAL_BOUNDS.maxLon}].`
    );
    error.statusCode = 400;
    throw error;
  }

  // Validate category
  const category = data.category || "DIRECT_STARLING";
  if (!VALID_CATEGORIES.includes(category)) {
    const error = new Error(
      `Kategori '${category}' tidak valid. Kategori yang didukung: ${VALID_CATEGORIES.join(", ")}`
    );
    error.statusCode = 400;
    throw error;
  }

  // Validate weight
  let finalWeight = data.weight !== null && data.weight !== undefined ? Number(data.weight) : CATEGORY_DEFAULT_WEIGHTS[category];
  if (!Number.isInteger(finalWeight) || finalWeight < 1 || finalWeight > 3) {
    const error = new Error(
      `Nilai 'weight' (${data.weight}) harus berupa bilangan bulat antara 1 dan 3.`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    zone_id: data.zone_id.trim(),
    name: data.name.trim(),
    category,
    weight: finalWeight,
    latitude: latNum,
    longitude: lonNum,
  };
}

export class POICompetitorService {
  static instance = null;

  constructor(repo = competitorRepository, dbPool = pool) {
    if (POICompetitorService.instance && repo === competitorRepository) {
      return POICompetitorService.instance;
    }
    this.repo = repo;
    this.pool = dbPool;
    if (repo === competitorRepository) {
      POICompetitorService.instance = this;
    }
  }

  static getInstance(repo = competitorRepository, dbPool = pool) {
    if (!POICompetitorService.instance) {
      POICompetitorService.instance = new POICompetitorService(repo, dbPool);
    }
    return POICompetitorService.instance;
  }

  /**
   * Helper to ensure zone exists
   */
  async ensureZoneExists(zoneId) {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return zone;
  }

  /**
   * Compute DSS Score C6 (Weighted Competitor Index - Cost) per Zone ID
   * Complies with Contract v1.0
   */
  async getZoneC6Score(zoneId) {
    const zone = await this.ensureZoneExists(zoneId);
    const scoreData = await this.repo.getZoneCompetitorScore(zone.polygon);
    return {
      zone_id: zone.id,
      zone_name: zone.name,
      skor_c6: scoreData.skor_c6,
      total_competitors_count: scoreData.total_competitors_count,
      field_competitors_count: scoreData.field_competitors_count,
      coffee_poi_count: scoreData.coffee_poi_count,
      reconciliation_summary: scoreData.reconciliation_summary,
      details: scoreData.details,
    };
  }

  /**
   * Fetch survey competitors list by Zone ID
   */
  async getCompetitorsByZone(zoneId) {
    await this.ensureZoneExists(zoneId);
    return await this.repo.findByZoneId(zoneId);
  }

  /**
   * Fetch citywide competitor summary
   */
  async getCompetitorsSummary() {
    return await this.repo.getCompetitorsSummary();
  }

  /**
   * Add new field competitor survey record (Contract v1.0 Section 3)
   * Enforces reconciliation_status = 'UNLINKED' on ordinary creation.
   */
  async createCompetitor(data) {
    const validated = validateCompetitorInput(data);
    await this.ensureZoneExists(validated.zone_id);

    // Ordinary creation MUST NOT allow caller to inject DEFINITIVE_MATCH or anchors
    const sanitizedData = {
      zone_id: validated.zone_id,
      name: validated.name,
      category: validated.category,
      weight: validated.weight,
      latitude: validated.latitude,
      longitude: validated.longitude,
      matched_external_id: null,
      matched_logical_poi_id: null,
      matched_poi_id: null,
      reconciliation_status: "UNLINKED",
    };

    return await this.repo.createCompetitor(sanitizedData);
  }

  /**
   * Ingest a batch of field survey competitors atomically (Contract v1.0 AC-CS-08)
   */
  async bulkCreateCompetitors(items) {
    if (!Array.isArray(items) || items.length === 0) {
      const error = new Error("Daftar item survei kompetitor wajib berupa array tidak kosong.");
      error.statusCode = 400;
      throw error;
    }

    // Validate all items defensivly before database touch
    const validatedItems = [];
    const zoneIds = new Set();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const validated = validateCompetitorInput(item);
        validatedItems.push(validated);
        zoneIds.add(validated.zone_id);
      } catch (err) {
        const batchError = new Error(`Validasi gagal pada batch item [${i}]: ${err.message}`);
        batchError.statusCode = 400;
        throw batchError;
      }
    }

    // Ensure all referenced zones exist
    for (const zId of zoneIds) {
      await this.ensureZoneExists(zId);
    }

    // Process bulk insertion in repository
    const createdRecords = await this.repo.bulkCreateCompetitors(validatedItems);

    return {
      total_submitted: items.length,
      total_created: createdRecords.length,
      records: createdRecords,
    };
  }

  /**
   * Explicitly reconcile a survey competitor with a canonical POI (Level 1 / ADR-03 / Section 4)
   */
  async reconcileExplicitLink({ competitorId, logicalPoiId, externalId = null, poiId = null }) {
    if (!competitorId) {
      const error = new Error("Parameter 'competitorId' wajib diisi untuk rekonsiliasi eksplisit.");
      error.statusCode = 400;
      throw error;
    }

    if (!logicalPoiId && !poiId) {
      const error = new Error("Identitas target POI ('logicalPoiId' atau 'poiId') wajib diisi.");
      error.statusCode = 400;
      throw error;
    }

    const competitor = await this.repo.findById(competitorId);
    if (!competitor) {
      const error = new Error("Data kompetitor survei tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    // Verify target POI in database and check identity consistency
    let verifiedLogicalPoiId = logicalPoiId;
    let verifiedExternalId = externalId;
    let verifiedPoiId = poiId;

    if (poiId) {
      const { rows: poiRows } = await this.pool.query(
        "SELECT id, logical_poi_id, external_id FROM pois WHERE id = $1;",
        [poiId]
      );
      if (poiRows.length === 0) {
        const error = new Error(`Target POI dengan id '${poiId}' tidak ditemukan di database.`);
        error.statusCode = 404;
        throw error;
      }
      const targetPoi = poiRows[0];
      if (logicalPoiId && targetPoi.logical_poi_id !== logicalPoiId) {
        const error = new Error(
          `Inkonsistensi identitas: POI memiliki logical_poi_id '${targetPoi.logical_poi_id}', tidak cocok dengan parameter '${logicalPoiId}'.`
        );
        error.statusCode = 400;
        throw error;
      }
      if (externalId && targetPoi.external_id !== externalId) {
        const error = new Error(
          `Inkonsistensi identitas: POI memiliki external_id '${targetPoi.external_id}', tidak cocok dengan parameter '${externalId}'.`
        );
        error.statusCode = 400;
        throw error;
      }

      verifiedLogicalPoiId = targetPoi.logical_poi_id;
      verifiedExternalId = targetPoi.external_id;
      verifiedPoiId = targetPoi.id;
    } else {
      // Query by logical_poi_id
      const { rows: poiRows } = await this.pool.query(
        "SELECT id, logical_poi_id, external_id FROM pois WHERE logical_poi_id = $1 ORDER BY (duplicate_of IS NULL) DESC, created_at ASC LIMIT 1;",
        [logicalPoiId]
      );
      if (poiRows.length === 0) {
        const error = new Error(`Target POI dengan logical_poi_id '${logicalPoiId}' tidak ditemukan.`);
        error.statusCode = 404;
        throw error;
      }
      const targetPoi = poiRows[0];
      if (externalId && targetPoi.external_id !== externalId) {
        const error = new Error(
          `Inkonsistensi identitas: POI memiliki external_id '${targetPoi.external_id}', tidak cocok dengan parameter '${externalId}'.`
        );
        error.statusCode = 400;
        throw error;
      }

      verifiedLogicalPoiId = targetPoi.logical_poi_id;
      verifiedExternalId = targetPoi.external_id || externalId;
      verifiedPoiId = targetPoi.id;
    }

    // Invariant: DEFINITIVE_MATCH requires non-null logical identity and external identity
    if (!verifiedLogicalPoiId || !verifiedExternalId) {
      const error = new Error("Rekonsiliasi definitif memerlukan logical_poi_id dan external_id yang valid.");
      error.statusCode = 400;
      throw error;
    }

    return await this.repo.updateReconciliation(competitorId, {
      reconciliation_status: "DEFINITIVE_MATCH",
      matched_logical_poi_id: verifiedLogicalPoiId,
      matched_external_id: verifiedExternalId,
      matched_poi_id: verifiedPoiId,
    });
  }

  /**
   * Detect Level 3 candidate matches in a zone (Contract v1.0 Section 5)
   * Candidate status is strictly review metadata and does NOT cause C6 exclusion.
   */
  async detectCandidateMatches(zoneId) {
    await this.ensureZoneExists(zoneId);

    const competitors = await this.repo.findByZoneId(zoneId);
    const candidateMatches = [];

    for (const comp of competitors) {
      if (comp.reconciliation_status === "DEFINITIVE_MATCH") continue;

      const nearbyPois = await this.repo.findNearbyCoffeePoisForCompetitor(
        comp.id,
        CANDIDATE_PROXIMITY_METERS
      );

      for (const poi of nearbyPois) {
        const similarity = calculateStringSimilarity(comp.name, poi.poi_name);
        if (similarity >= CANDIDATE_SIMILARITY_THRESHOLD) {
          const updated = await this.repo.updateReconciliation(comp.id, {
            reconciliation_status: "CANDIDATE_MATCH",
            matched_logical_poi_id: poi.logical_poi_id,
            matched_external_id: poi.external_id,
            matched_poi_id: poi.poi_id,
          });

          candidateMatches.push({
            competitor_id: comp.id,
            competitor_name: comp.name,
            poi_id: poi.poi_id,
            poi_name: poi.poi_name,
            distance_meters: parseFloat(poi.distance_meters),
            similarity_score: similarity,
            updated_competitor: updated,
          });
          break; // Stop at closest matching candidate
        }
      }
    }

    return candidateMatches;
  }

  /**
   * Reset reconciliation status back to UNLINKED
   */
  async unlinkReconciliation(competitorId) {
    const competitor = await this.repo.findById(competitorId);
    if (!competitor) {
      const error = new Error("Data kompetitor survei tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    return await this.repo.updateReconciliation(competitorId, {
      reconciliation_status: "UNLINKED",
      matched_logical_poi_id: null,
      matched_external_id: null,
      matched_poi_id: null,
    });
  }

  /**
   * Delete field competitor entry by ID
   */
  async deleteCompetitor(id) {
    const deleted = await this.repo.deleteCompetitor(id);
    if (!deleted) {
      const error = new Error("Data kompetitor tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return { message: "Data kompetitor berhasil dihapus", competitor: deleted };
  }
}

export const poiCompetitorService = POICompetitorService.getInstance();
