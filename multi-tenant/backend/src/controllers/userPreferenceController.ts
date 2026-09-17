/*
 * userPreferenceController.ts
 * Controller for managing user personal preferences (map theme, notifications, layout)
 */

import type { Request, Response } from "express";
import { UserPreferenceModel } from "../models/userPreferenceModel.js";

export const getUserPreferences = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ msg: "Autentikasi diperlukan." });
    }

    let preferences = await UserPreferenceModel.getByUserId(userId);
    if (!preferences) {
      // Default fallback
      preferences = {
        user_id: userId,
        map_theme: "openmaptiles-dark",
        dashboard_layout: {},
        notifications_enabled: true,
      };
    }

    return res.status(200).json({ status: "success", preferences });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal mengambil preferensi pengguna." });
  }
};

export const updateUserPreferences = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ msg: "Autentikasi diperlukan." });
    }

    const { map_theme, dashboard_layout, notifications_enabled } = req.body;
    const updated = await UserPreferenceModel.upsert(userId, {
      map_theme,
      dashboard_layout,
      notifications_enabled,
    });

    return res.status(200).json({ status: "success", preferences: updated });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Gagal menyimpan preferensi pengguna." });
  }
};
