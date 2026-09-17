/*
 * auditController.ts
 * HTTP Controller for Audit Logs in TypeScript
 */

import type { Request, Response } from "express";
import { auditService } from "../services/auditService.js";

export const getAuditLogs = async (req: Request, res: Response): Promise<any> => {
  try {
    const { user_id, action, entity_type, status, page, limit } = req.query as any;
    const result = await auditService.getAuditLogs({
      userId: user_id,
      action,
      entityType: entity_type,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
