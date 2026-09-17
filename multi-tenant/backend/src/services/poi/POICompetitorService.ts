/*
 * POICompetitorService.ts
 * Service Orchestrator for DSS Criteria C6 Competitor Evaluation in TypeScript
 */

import { ZoneModel } from "../../models/zoneModel.js";
import { competitorRepository, CompetitorRepository } from "../../repositories/competitorRepository.js";

export class POICompetitorService {
  private static instance: POICompetitorService | null = null;
  private repo: CompetitorRepository;

  constructor(repo: CompetitorRepository = competitorRepository) {
    if (POICompetitorService.instance && repo === competitorRepository) {
      return POICompetitorService.instance;
    }
    this.repo = repo;
    if (repo === competitorRepository) {
      POICompetitorService.instance = this;
    }
  }

  public static getInstance(): POICompetitorService {
    if (!POICompetitorService.instance) {
      POICompetitorService.instance = new POICompetitorService();
    }
    return POICompetitorService.instance;
  }

  /**
   * Compute DSS Score C6 (Weighted Competitor Index - Cost) per Zone ID
   */
  public async getZoneC6Score(zoneId: number | string): Promise<any> {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error: any = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

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
   * Fetch all survey competitors (optionally filtered by zoneId)
   */
  public async getAllCompetitors(zoneId?: number | string | null): Promise<any[]> {
    return await this.repo.findAll(zoneId);
  }

  /**
   * Fetch survey competitors list by Zone ID
   */
  public async getCompetitorsByZone(zoneId: number | string): Promise<any[]> {
    const zone = await ZoneModel.findById(zoneId);
    if (!zone) {
      const error: any = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return await this.repo.findByZoneId(zoneId);
  }

  /**
   * Add new field competitor survey record
   */
  public async createCompetitor(data: {
    zone_id: number | string;
    name: string;
    category?: string;
    weight?: number;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<any> {
    if (!data.zone_id || !data.name) {
      const error: any = new Error("Parameter 'zone_id' dan 'name' wajib diisi");
      error.statusCode = 400;
      throw error;
    }

    const zone = await ZoneModel.findById(data.zone_id);
    if (!zone) {
      const error: any = new Error("Zona tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    return await this.repo.createCompetitor(data);
  }

  /**
   * Delete field competitor entry by ID
   */
  public async deleteCompetitor(id: number | string): Promise<any> {
    const deleted = await this.repo.deleteCompetitor(id);
    if (!deleted) {
      const error: any = new Error("Data kompetitor tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    return { message: "Data kompetitor berhasil dihapus", competitor: deleted };
  }
}

export const poiCompetitorService = POICompetitorService.getInstance();
