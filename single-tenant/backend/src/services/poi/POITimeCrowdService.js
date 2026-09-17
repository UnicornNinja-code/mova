import { PoiCategoryModel } from "../../models/poiCategoryModel.js";
import { poiRepository } from "../../repositories/poiRepository.js";
import { TimeSlotEvaluator } from "../../utils/TimeSlotEvaluator.js";
import { auditLogger } from "../../utils/AuditLogger.js";

const MIN_LIKERT_SCORE = 1;
const MAX_LIKERT_SCORE = 5;

export class POITimeCrowdService {
  static instance = null;

  constructor() {
    if (POITimeCrowdService.instance) {
      return POITimeCrowdService.instance;
    }
    POITimeCrowdService.instance = this;
  }

  static getInstance() {
    if (!POITimeCrowdService.instance) {
      POITimeCrowdService.instance = new POITimeCrowdService();
    }
    return POITimeCrowdService.instance;
  }

  /**
   * Helper to validate single Likert rating (must be integer 1 to 5)
   */
  validateLikertScore(score, scoreName) {
    if (score !== undefined && score !== null) {
      const num = Number(score);
      if (!Number.isInteger(num) || num < MIN_LIKERT_SCORE || num > MAX_LIKERT_SCORE) {
        const error = new Error(`Nilai ${scoreName} harus berupa angka bulat antara ${MIN_LIKERT_SCORE} dan ${MAX_LIKERT_SCORE} (Skala Likert).`);
        error.statusCode = 400;
        throw error;
      }
      return num;
    }
    return undefined;
  }


  /**
   * Fetch standardized C3 Master Data crowd scores configuration
   */
  async getCrowdScoresStandard() {
    const categories = await PoiCategoryModel.getCrowdScores();
    return {
      status: "success",
      evaluation_version: "DSS-CRITERIA-v1.0",
      methodology: "EXPERT_BASELINE_LIKERT_1_5",
      time_slots: ["pagi", "siang", "sore", "malam"],
      categories,
    };
  }

  /**
   * Update time-based crowd scores for a single category by ID with audit logging
   */
  async updateCategoryTimeScores(categoryId, payload, authUser = null) {
    const category = await PoiCategoryModel.findById(categoryId);
    if (!category) {
      const error = new Error(`Kategori POI dengan ID '${categoryId}' tidak ditemukan.`);
      error.statusCode = 404;
      throw error;
    }

    const pagi = payload.pagi !== undefined ? payload.pagi : payload.score_pagi;
    const siang = payload.siang !== undefined ? payload.siang : payload.score_siang;
    const sore = payload.sore !== undefined ? payload.sore : payload.score_sore;
    const malam = payload.malam !== undefined ? payload.malam : payload.score_malam;

    const validatedPagi = this.validateLikertScore(pagi, "score_pagi");
    const validatedSiang = this.validateLikertScore(siang, "score_siang");
    const validatedSore = this.validateLikertScore(sore, "score_sore");
    const validatedMalam = this.validateLikertScore(malam, "score_malam");

    const previousScores = {
      pagi: category.score_pagi,
      siang: category.score_siang,
      sore: category.score_sore,
      malam: category.score_malam,
    };

    const updatedCategory = await PoiCategoryModel.updateTimeScores(categoryId, {
      score_pagi: validatedPagi,
      score_siang: validatedSiang,
      score_sore: validatedSore,
      score_malam: validatedMalam,
    });

    const newScores = {
      pagi: updatedCategory.score_pagi,
      siang: updatedCategory.score_siang,
      sore: updatedCategory.score_sore,
      malam: updatedCategory.score_malam,
    };

    // Non-blocking Audit Logging
    await auditLogger.logAction({
      userId: authUser?.id || authUser?.userId || null,
      userRole: authUser?.role || "SUPERADMIN",
      action: "UPDATE_POI_CATEGORY_CROWD_SCORES",
      entityType: "POI_CATEGORY",
      entityId: categoryId,
      details: {
        category_id: categoryId,
        category_name: category.name,
        previous_scores: previousScores,
        new_scores: newScores,
      },
    });

    return updatedCategory;
  }

  /**
   * Bulk update time-based crowd scores for multiple categories with audit logging
   */
  async bulkUpdateCategoryTimeScores(items, authUser = null) {
    if (!Array.isArray(items) || items.length === 0) {
      const error = new Error("Data bulk update harus berupa array berisi objek kategori POI.");
      error.statusCode = 400;
      throw error;
    }

    const validatedItems = items.map((item, index) => {
      const targetId = item.id || item.category_id;
      if (!targetId && !item.name) {
        const error = new Error(`Item pada index ${index} harus menyertakan 'category_id', 'id', atau 'name'.`);
        error.statusCode = 400;
        throw error;
      }

      const pagi = item.pagi !== undefined ? item.pagi : item.score_pagi;
      const siang = item.siang !== undefined ? item.siang : item.score_siang;
      const sore = item.sore !== undefined ? item.sore : item.score_sore;
      const malam = item.malam !== undefined ? item.malam : item.score_malam;

      return {
        id: targetId,
        name: item.name,
        score_pagi: this.validateLikertScore(pagi, `score_pagi (item ${index})`),
        score_siang: this.validateLikertScore(siang, `score_siang (item ${index})`),
        score_sore: this.validateLikertScore(sore, `score_sore (item ${index})`),
        score_malam: this.validateLikertScore(malam, `score_malam (item ${index})`),
      };
    });

    const updated = await PoiCategoryModel.bulkUpdateTimeScores(validatedItems);

    // Non-blocking Audit Logging
    await auditLogger.logAction({
      userId: authUser?.id || authUser?.userId || null,
      userRole: authUser?.role || "SUPERADMIN",
      action: "BULK_UPDATE_POI_CATEGORY_CROWD_SCORES",
      entityType: "POI_CATEGORY",
      entityId: "BULK",
      details: {
        total_updated: updated.length,
        updated_categories: updated.map((c) => ({
          id: c.id,
          name: c.name,
          scores: {
            pagi: c.score_pagi,
            siang: c.score_siang,
            sore: c.score_sore,
            malam: c.score_malam,
          },
        })),
      },
    });

    return updated;
  }

  /**
   * Calculate dynamic C3 score for a given zone polygon and time
   */
  async calculateZoneC3Score(zonePolygon, timeInput) {
    const activeSlot = TimeSlotEvaluator.getSlot(timeInput);
    const result = await poiRepository.getTimeCrowdScoreByZonePolygon(zonePolygon, activeSlot);

    return {
      active_time_slot: activeSlot,
      total_pois: result.total_pois,
      total_c3_score: Math.round((result.total_c3_score || 0) * 100) / 100,
      avg_c3_score: Math.round((result.avg_c3_score || 0) * 100) / 100,
      is_off_hours: activeSlot === "off_hours",
    };
  }
}

export const poiTimeCrowdService = POITimeCrowdService.getInstance();

