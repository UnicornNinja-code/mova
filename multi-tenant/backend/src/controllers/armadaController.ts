/*
 * armadaController.ts
 * HTTP Controller for 3-Dimensional Armada Management in TypeScript
 */

import type { Request, Response } from "express";
import { armadaService } from "../services/armadaService.js";

export const getAllArmadas = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, type, reservation_state } = req.query as { status?: string; type?: string; reservation_state?: string };
    const result = await armadaService.getAllArmadas({ status, type, reservation_state });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getArmadaById = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const armada = await armadaService.getArmadaById(id);
    return res.status(200).json({ armada });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const createArmada = async (req: Request, res: Response): Promise<any> => {
  try {
    const { code, name, type, status } = req.body;
    const newArmada = await armadaService.createArmada(
      { code, name, type, status },
      req.user as any
    );
    return res.status(201).json({
      msg: "Unit armada berhasil ditambahkan",
      armada: newArmada,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const updateArmada = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const { code, type, status, current_rider_id, force } = req.body;

    const updated = await armadaService.updateArmada(
      id,
      {
        code,
        type,
        status,
        current_rider_id,
        force,
      },
      req.user as any
    );

    return res.status(200).json({
      msg: "Data unit armada berhasil diperbarui",
      armada: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const deleteArmada = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = req.params.id as string;
    const deleted = await armadaService.deleteArmada(id, req.user as any);
    return res.status(200).json({
      msg: "Unit armada berhasil dihapus",
      armada: deleted,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const reportArmadaIssue = async (req: Request, res: Response): Promise<any> => {
  try {
    const armadaId = req.params.id as string;
    const riderId = req.user?.id || req.body.rider_id;
    const { severity, issue_type, issueType, description } = req.body;

    const issue = await armadaService.reportIssue({
      armadaId,
      riderId,
      severity: severity || "MINOR",
      issueType: issue_type || issueType || "OTHER",
      description,
    });

    return res.status(201).json({
      msg: "Laporan kendala armada berhasil dikirimkan ke Supervisor / Manajemen.",
      issue,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getAllIssueReports = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status } = req.query as { status?: string };
    const issues = await armadaService.getIssueReports(status);
    return res.status(200).json({ issues, count: issues.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const resolveIssueReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const issueId = req.params.id as string;
    const { status, resolution_notes, resolutionNotes } = req.body;

    const updated = await armadaService.resolveIssueReport(
      issueId,
      {
        status,
        resolutionNotes: resolution_notes || resolutionNotes,
      },
      req.user as any
    );

    return res.status(200).json({
      msg: "Laporan kendala armada berhasil ditindaklanjuti.",
      issue: updated,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};

export const getArmadaHistory = async (req: Request, res: Response): Promise<any> => {
  try {
    const armadaId = req.params.id as string;
    const history = await armadaService.getArmadaHistory(armadaId);
    return res.status(200).json({ history, count: history.length });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message || "Internal server error" });
  }
};
