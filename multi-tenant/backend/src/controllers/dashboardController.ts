/*
 * dashboardController.ts
 * HTTP Controller for Dashboard Analytics Endpoints in TypeScript
 */

import type { Request, Response } from "express";
import { dashboardService } from "../services/dashboard/DashboardService.js";

export const getSummary = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user?.role;
    const { date } = req.query as { date?: string };

    const summary = await dashboardService.getDashboardSummary(userRole, { date });

    return res.status(200).json({
      status: "success",
      data: summary,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getSalesTrend = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user?.role;
    const { range, start_date, end_date } = req.query as { range?: string; start_date?: string; end_date?: string };

    const trend = await dashboardService.getSalesTrend(userRole, {
      range,
      startDate: start_date,
      endDate: end_date,
    });

    return res.status(200).json({
      status: "success",
      data: trend,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getZonePerformance = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user?.role;
    const { date } = req.query as { date?: string };

    const performance = await dashboardService.getZonePerformance(userRole, { date });

    return res.status(200).json({
      status: "success",
      data: performance,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getProductPerformance = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user?.role;
    const { range, start_date, end_date } = req.query as { range?: string; start_date?: string; end_date?: string };

    const performance = await dashboardService.getProductPerformance(userRole, {
      range,
      startDate: start_date,
      endDate: end_date,
    });

    return res.status(200).json({
      status: "success",
      data: performance,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
