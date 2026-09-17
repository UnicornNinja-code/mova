/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   dashboardController.js (HTTP Controller for Dashboard Analytics Endpoints)
 */

import { dashboardService } from "../services/dashboard/DashboardService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export const getSummary = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { date } = req.query;

    const summary = await dashboardService.getDashboardSummary(userRole, { date });
    return sendSuccess(res, summary, "Dashboard summary berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getSalesTrend = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { range, start_date, end_date } = req.query;

    const trend = await dashboardService.getSalesTrend(userRole, {
      range,
      startDate: start_date,
      endDate: end_date,
    });

    return sendSuccess(res, trend, "Tren penjualan berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getZonePerformance = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { date } = req.query;

    const performance = await dashboardService.getZonePerformance(userRole, { date });
    return sendSuccess(res, performance, "Performa zona berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getProductPerformance = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { range, start_date, end_date } = req.query;

    const performance = await dashboardService.getProductPerformance(userRole, {
      range,
      startDate: start_date,
      endDate: end_date,
    });

    return sendSuccess(res, performance, "Performa produk berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

export const getQuickAlerts = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { zone_id } = req.query;

    const quickAlerts = await dashboardService.getQuickAlerts(userRole, { zone_id });
    return sendSuccess(res, quickAlerts, "Peringatan operasional berhasil dimuat.", 200);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendError(res, error.message || "Internal server error", statusCode);
  }
};

