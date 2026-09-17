/*
 * POICompetitorService.js
 * Service Orchestrator for DSS Criteria C6 (Competitor Pressure - Cost Evaluation)
 */

import { ZoneModel } from "../../models/zoneModel.js";
import { competitorRepository } from "../../repositories/competitorRepository.js";

export class POICompetitorService {
  static instance = null;

  constructor(repo = competitorRepository) {
    if (POICompetitorService.instance && repo === competitorRepository) {
      return POICompetitorService.instance;
    }
    this.repo = repo;
    if (repo === competitorRepository) {
      POICompetitorService.instance = this;
    }
  }

  static getInstance() {
    if (!POICompetitorService.instance) {
      POICompetitorService.instance = new POICompetitorService();
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
   * Add new field competitor survey record
   */
  async createCompetitor(data) {
    if (!data.zone_id || !data.name) {
      const error = new Error("Parameter 'zone_id' dan 'name' wajib diisi");
      error.statusCode = 400;
      throw error;
    }

    await this.ensureZoneExists(data.zone_id);
    return await this.repo.createCompetitor(data);
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

