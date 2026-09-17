/*
 * cronController.ts
 * HTTP Controller for Cron Management Engine in TypeScript
 */

import type { Request, Response } from "express";
import { cronManagerService } from "../services/cron/CronManagerService.js";

export const getCronConfigs = async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await cronManagerService.getCronConfigs();
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getCronLogs = async (req: Request, res: Response): Promise<any> => {
  try {
    const { cron_key, limit } = req.query as { cron_key?: string; limit?: string };
    const result = await cronManagerService.getCronLogs({
      cronKey: cron_key,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const toggleCronActive = async (req: Request, res: Response): Promise<any> => {
  try {
    const cronKey = req.params.cronKey as string;
    const { is_active } = req.body;

    const updated = await cronManagerService.toggleCronActive(cronKey, is_active);
    return res.status(200).json({
      msg: `Status cron job '${cronKey}' berhasil diubah`,
      config: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const triggerCronManually = async (req: Request, res: Response): Promise<any> => {
  try {
    const cronKey = req.params.cronKey as string;
    const result = await cronManagerService.triggerCronManually(cronKey);
    return res.status(200).json({
      msg: `Pemicu eksekusi manual cron job '${cronKey}' berhasil dijalankan`,
      result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
