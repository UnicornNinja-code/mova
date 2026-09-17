/*
 * riderOperationalController.ts
 * HTTP Controller for Rider Operational Engine in TypeScript
 */

import type { Request, Response } from "express";
import { riderOperationalService } from "../services/rider/RiderOperationalService.js";

export const getActiveSession = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user?.id || req.query?.rider_id;
    const result = await riderOperationalService.getRiderActiveSession(riderId as any);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getHubArmadas = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user?.id || req.query?.rider_id;
    const result = await riderOperationalService.getHubArmadaCatalog(riderId as any);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const holdArmada = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const { armada_id } = req.body;

    const result = await riderOperationalService.inspectAndHoldArmada({
      riderId,
      armadaId: armada_id,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const cancelHoldArmada = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const { armada_id } = req.body;

    const result = await riderOperationalService.cancelArmadaHold({
      riderId,
      armadaId: armada_id,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const confirmClaimArmada = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const { armada_id, checklist, notes } = req.body;

    const result = await riderOperationalService.confirmArmadaClaim({
      riderId,
      armadaId: armada_id,
      checklist,
      notes,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const checkInZone = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const lat = req.body.latitude !== undefined ? req.body.latitude : req.body.lat;
    const lon = req.body.longitude !== undefined ? req.body.longitude : req.body.lon;

    const result = await riderOperationalService.checkInToZone({
      riderId,
      lat,
      lon,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const recordSale = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user.id;
    const productId = req.body.product_id || req.body.productId;
    const quantity = req.body.quantity !== undefined ? req.body.quantity : req.body.qty;
    const paymentMethod = req.body.payment_method || req.body.paymentMethod || "CASH";
    const idempotencyKey = (req.headers["idempotency-key"] as string) || req.body.idempotency_key;
    const lat = req.body.latitude || req.body.lat;
    const lon = req.body.longitude || req.body.lon;

    const result = await riderOperationalService.recordProductSale({
      riderId,
      productId,
      quantity,
      paymentMethod,
      idempotencyKey,
      lat,
      lon,
    });
    return res.status(200).json(result);
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

export const checkoutSession = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user.id;
    const returnStatus = req.body.return_status || req.body.returnStatus || "ACTIVE";
    const inspectionCondition = req.body.inspection_condition || req.body.inspectionCondition || {};
    const notes = req.body.notes;
    const remainingCups = req.body.remaining_cups !== undefined ? req.body.remaining_cups : req.body.remainingCups || 0;
    const actualCashSubmitted = req.body.actual_cash_submitted !== undefined ? req.body.actual_cash_submitted : req.body.actualCashSubmitted || 0;
    const discrepancyAmount = req.body.discrepancy_amount !== undefined ? req.body.discrepancy_amount : req.body.discrepancyAmount || 0;
    const discrepancyReason = req.body.discrepancy_reason || req.body.discrepancyReason || "";

    const result = await riderOperationalService.checkoutAndReturnArmada({
      riderId,
      returnStatus,
      inspectionCondition,
      notes,
      remainingCups,
      actualCashSubmitted,
      discrepancyAmount,
      discrepancyReason,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
