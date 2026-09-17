/*
 * candidateSellingLocationController.ts
 * Express HTTP Controller for Candidate Selling Locations REST API in TypeScript
 */

import type { Request, Response, NextFunction } from "express";
import { candidateSellingLocationService } from "../services/candidateSellingLocationService.js";
import { candidateSellingLocationRepository } from "../repositories/candidateSellingLocationRepository.js";

export class CandidateSellingLocationController {
  public async createCandidate(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { zone_id, poi_id, name, latitude, longitude, source } = req.body;
      const result = await candidateSellingLocationService.createCandidateSellingLocation({
        zone_id,
        poi_id,
        name,
        latitude,
        longitude,
        source,
      });

      return res.status(201).json({
        success: true,
        message: "Candidate selling location created successfully.",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getCandidatesByZone(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const zoneId = req.params.zoneId as string;
      const candidates = await candidateSellingLocationService.getCandidatesByZone(zoneId);

      return res.status(200).json({
        success: true,
        total: candidates.length,
        data: candidates,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getCandidateById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const id = req.params.id as string;
      const candidate = await candidateSellingLocationRepository.findById(id);

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: `Candidate selling location with ID '${id}' not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: candidate,
      });
    } catch (err) {
      next(err);
    }
  }

  public async generateCandidatesFromZonePois(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const zoneId = req.params.zoneId as string;
      const generated = await candidateSellingLocationService.generateCandidatesFromZonePois(zoneId);

      return res.status(200).json({
        success: true,
        message: `Generated ${generated.length} candidate locations from eligible zone POIs.`,
        data: generated,
      });
    } catch (err) {
      next(err);
    }
  }

  public async evaluateCandidate(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const id = req.params.id as string;
      const { timeSlot, riderLat, riderLon } = req.body || {};
      const result = await candidateSellingLocationService.evaluateCandidateSellingLocation(id, {
        timeSlot,
        riderLat,
        riderLon,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async evaluateZoneCandidates(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const zoneId = req.params.zoneId as string;
      const { timeSlot, riderLat, riderLon } = req.body || {};
      const result = await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(zoneId, {
        timeSlot,
        riderLat,
        riderLon,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getEvaluationSnapshot(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const evaluationId = req.params.evaluationId as string;
      const result = await candidateSellingLocationService.getEvaluationSnapshotById(evaluationId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getEvaluationExplanation(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const evaluationId = req.params.evaluationId as string;
      const snapshot = await candidateSellingLocationService.getEvaluationSnapshotById(evaluationId);

      return res.status(200).json({
        success: true,
        data: {
          evaluation_id: snapshot.evaluation_id,
          explanations: snapshot.explanations,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public async getEvaluationAudit(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const evaluationId = req.params.evaluationId as string;
      const snapshot = await candidateSellingLocationService.getEvaluationSnapshotById(evaluationId);

      return res.status(200).json({
        success: true,
        data: {
          audit: snapshot.audit,
          criteria_specs: snapshot.criteria_specs,
          ideal_positive: snapshot.ideal_positive,
          ideal_negative: snapshot.ideal_negative,
          total_evaluated_candidates: snapshot.total_evaluated_candidates,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const candidateSellingLocationController = new CandidateSellingLocationController();
