import {
  getAllPoiCategoriesService,
  togglePoiCategoryStatusService,
  updatePoiCategoryTimeScoresService,
  bulkUpdatePoiCategoryTimeScoresService,
} from "../services/poiService.js";
import { poiTimeCrowdService } from "../services/poi/POITimeCrowdService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const getAllPoiCategories = async (req, res) => {
  try {
    const categories = await getAllPoiCategoriesService();
    return sendSuccess(res, categories, "POI categories retrieved successfully", 200, {
      categories,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const togglePoiCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await togglePoiCategoryStatusService(id);
    const statusLabel = category.is_active ? "active" : "inactive";
    return sendSuccess(
      res,
      category,
      `POI category '${category.name}' is now ${statusLabel}`,
      200,
      { category }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getCrowdScores = async (req, res) => {
  try {
    const data = await poiTimeCrowdService.getCrowdScoresStandard();
    return sendSuccess(res, data, "Crowd scores retrieved successfully");
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateBulkCrowdScores = async (req, res) => {
  try {
    const items = req.body.scores || req.body.categories || req.body;
    if (!Array.isArray(items)) {
      return sendError(res, "Payload 'scores' harus berupa array berisi penilaian kategori POI.", 400);
    }
    const updated = await poiTimeCrowdService.bulkUpdateCategoryTimeScores(items, req.user);
    return sendSuccess(
      res,
      updated,
      `Berhasil memperbarui skor keramaian berbasis waktu untuk ${updated.length} kategori POI`,
      200,
      {
        total_updated: updated.length,
        categories: updated,
      }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateSingleCrowdScores = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await poiTimeCrowdService.updateCategoryTimeScores(id, req.body, req.user);
    return sendSuccess(
      res,
      updated,
      `Skor keramaian berbasis waktu untuk kategori '${updated.name}' berhasil diperbarui`,
      200,
      { category: updated }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updatePoiCategoryTimeScores = async (req, res) => {
  try {
    const { id } = req.params;
    const { score_pagi, score_siang, score_sore, score_malam } = req.body;
    const category = await updatePoiCategoryTimeScoresService(
      id,
      { score_pagi, score_siang, score_sore, score_malam },
      req.user
    );
    return sendSuccess(
      res,
      category,
      `Skor keramaian berbasis waktu untuk kategori '${category.name}' berhasil diperbarui`,
      200,
      { category }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const bulkUpdatePoiCategoryTimeScores = async (req, res) => {
  try {
    const { categories } = req.body;
    const updated = await bulkUpdatePoiCategoryTimeScoresService(categories, req.user);
    return sendSuccess(
      res,
      updated,
      `Berhasil memperbarui skor keramaian berbasis waktu untuk ${updated.length} kategori POI`,
      200,
      { categories: updated }
    );
  } catch (error) {
    return handleControllerError(res, error);
  }
};


