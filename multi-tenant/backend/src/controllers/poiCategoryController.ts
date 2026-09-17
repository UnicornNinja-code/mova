/*
 * poiCategoryController.ts
 * HTTP Controller for POI Category Management in TypeScript
 */

import type { Request, Response } from "express";
import {
  getAllPoiCategoriesService,
  togglePoiCategoryStatusService,
  updatePoiCategoryTimeScoresService,
  bulkUpdatePoiCategoryTimeScoresService,
} from "../services/poiService.js";

export const getAllPoiCategories = async (req: Request, res: Response): Promise<any> => {
  try {
    const categories = await getAllPoiCategoriesService();
    return res.status(200).json({ categories });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const togglePoiCategoryStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const category = await togglePoiCategoryStatusService(id);
    return res.status(200).json({
      msg: `POI category '${category.name}' is now ${category.is_active ? "active" : "inactive"}`,
      category,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updatePoiCategoryTimeScores = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { score_pagi, score_siang, score_sore, score_malam } = req.body;
    const category = await updatePoiCategoryTimeScoresService(id, {
      score_pagi,
      score_siang,
      score_sore,
      score_malam,
    });
    return res.status(200).json({
      msg: `Skor keramaian berbasis waktu untuk kategori '${category.name}' berhasil diperbarui`,
      category,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const bulkUpdatePoiCategoryTimeScores = async (req: Request, res: Response): Promise<any> => {
  try {
    const { categories } = req.body;
    const updated = await bulkUpdatePoiCategoryTimeScoresService(categories);
    return res.status(200).json({
      msg: `Berhasil memperbarui skor keramaian berbasis waktu untuk ${updated.length} kategori POI`,
      categories: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
