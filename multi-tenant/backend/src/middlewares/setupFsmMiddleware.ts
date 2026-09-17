/*
 * setupFsmMiddleware.ts
 * Finite State Machine (FSM) Guard Middleware for MOVA System Setup & Spatial Synchronization
 */

import type { Request, Response, NextFunction } from "express";
import { SystemSettingModel } from "../models/systemSettingModel.js";

export const checkSetupFsmMutationLock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const fsmState = await SystemSettingModel.getByKey("SYSTEM_SETUP_FSM_STATE");
    const currentState = fsmState?.value || "DRAFT";

    if (currentState === "LOCKED_SYNCING") {
      return res.status(409).json({
        success: false,
        code: "MUTATION_LOCKED",
        msg: "Perubahan parameter setup ditolak karena sinkronisasi spasial sedang berjalan aktif di latar belakang.",
        currentState,
      });
    }

    next();
  } catch (err: any) {
    next(err);
  }
};
