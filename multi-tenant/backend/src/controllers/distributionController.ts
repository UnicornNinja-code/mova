/*
 * distributionController.ts
 * HTTP Controller for Rider Distribution Engine, Operational Sessions & Queue Management in TypeScript
 */

import type { Request, Response } from "express";
import { distributionService } from "../services/distribution/DistributionService.js";

export const confirmDuty = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    if (!riderId) {
      return res.status(400).json({ msg: "Rider ID harus disertakan." });
    }

    const queueEntry = await distributionService.confirmRiderDuty(riderId);
    return res.status(200).json({
      msg: "Konfirmasi kesediaan bertugas berhasil. Rider telah masuk ke Antrean FIFO Sesi Operasional.",
      queue: queueEntry,
      session: queueEntry.session,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getDistributionOverview = async (req: Request, res: Response): Promise<any> => {
  try {
    const overview = await distributionService.getDistributionOverview();
    return res.status(200).json(overview);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const previewDistribution = async (req: Request, res: Response): Promise<any> => {
  try {
    const preview = await distributionService.previewDistribution();
    return res.status(200).json(preview);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const confirmDistribution = async (req: Request, res: Response): Promise<any> => {
  try {
    const { execution_type = "AUTO", allocations = [], unassigned_riders = [] } = req.body;
    const executedBy = req.user?.id;

    const result = await distributionService.confirmDistributionRun({
      executionType: execution_type,
      executedBy,
      allocations,
      unassignedRiders: unassigned_riders,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const autoDistribute = async (req: Request, res: Response): Promise<any> => {
  try {
    const executedBy = req.user?.id;
    const result = await distributionService.autoDistributeRiders(executedBy);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const manualDistribute = async (req: Request, res: Response): Promise<any> => {
  try {
    const { rider_id, zone_id } = req.body;
    const assignedBy = req.user?.id;

    const result = await distributionService.manualDistributeRider({
      riderId: rider_id,
      zoneId: zone_id,
      assignedBy,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getDistributionRuns = async (req: Request, res: Response): Promise<any> => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const runs = await distributionService.getDistributionRunsHistory(limit);
    return res.status(200).json({ runs });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateRiderDutyStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params; // rider_id
    const { status, notes } = req.body;
    const updatedBy = req.user?.id;

    const updated = await distributionService.updateRiderDutyStatus({
      riderId: String(id),
      status,
      notes,
      updatedBy,
    });

    return res.status(200).json({ msg: "Status antrean rider berhasil diperbarui.", updated });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const emergencySwap = async (req: Request, res: Response): Promise<any> => {
  try {
    const { previous_rider_id, new_rider_id, incident_type, notes, armada_action } = req.body;
    const supervisorId = req.user?.id;

    const result = await distributionService.emergencySwap({
      previousRiderId: previous_rider_id,
      newRiderId: new_rider_id,
      supervisorId,
      incidentType: incident_type,
      notes,
      armadaAction: armada_action,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

/**
 * Fetch authenticated rider's own duty and assignment history
 */
export const getMyDutyHistory = async (req: Request, res: Response): Promise<any> => {
  try {
    const riderId = req.user.id;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;

    const result = await distributionService.getMyDutyHistory(riderId, limit);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
