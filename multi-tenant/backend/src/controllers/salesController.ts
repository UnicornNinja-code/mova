/*
 * salesController.ts
 * HTTP Controller for Sales History & Overview in TypeScript
 */

import type { Request, Response } from "express";
import { salesService } from "../services/sales/SalesService.js";
import { riderOperationalService } from "../services/rider/RiderOperationalService.js";

export const getSalesOverview = async (req: Request, res: Response): Promise<any> => {
  try {
    const { start_date, end_date, zone_id, rider_id, product_id } = req.query as any;

    const overview = await salesService.getSalesOverview({
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
      riderId: rider_id,
      productId: product_id,
    });

    return res.status(200).json({
      status: "success",
      data: overview,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getMySales = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user.id;
    const { date, page, limit } = req.query as any;

    const result = await riderOperationalService.getMySalesHistory({
      riderId,
      date,
      page,
      limit,
    });

    return res.status(200).json({
      status: "success",
      data: result.sales,
      total_revenue: result.total_revenue,
      pagination: result.pagination,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
