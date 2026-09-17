import { candidateSellingLocationService } from "../services/candidateSellingLocationService.js";
import { candidateSellingLocationRepository } from "../repositories/candidateSellingLocationRepository.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export class CandidateSellingLocationController {
  async createCandidate(req, res) {
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

      return sendSuccess(res, result, "Candidate selling location created successfully.", 201);
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async getCandidatesByZone(req, res) {
    try {
      const { zoneId } = req.params;
      const candidates = await candidateSellingLocationService.getCandidatesByZone(zoneId);

      return sendSuccess(res, candidates, "Candidate locations retrieved successfully", 200, {
        total: candidates.length,
      });
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async getCandidateById(req, res) {
    try {
      const { id } = req.params;
      const candidate = await candidateSellingLocationRepository.findById(id);

      if (!candidate) {
        return sendError(res, `Candidate selling location with ID '${id}' not found.`, 404);
      }

      return sendSuccess(res, candidate, "Candidate location retrieved successfully");
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async generateCandidatesFromZonePois(req, res) {
    try {
      const { zoneId } = req.params;
      const generated = await candidateSellingLocationService.generateCandidatesFromZonePois(zoneId);

      return sendSuccess(
        res,
        generated,
        `Generated ${generated.length} candidate locations from eligible zone POIs.`
      );
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async evaluateCandidate(req, res) {
    try {
      const { id } = req.params;
      const { timeSlot, riderLat, riderLon } = req.body || {};
      const result = await candidateSellingLocationService.evaluateCandidateSellingLocation(id, {
        timeSlot,
        riderLat,
        riderLon,
      });

      return sendSuccess(res, result, "Candidate evaluated successfully");
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async evaluateZoneCandidates(req, res) {
    try {
      const { zoneId } = req.params;
      const { timeSlot, riderLat, riderLon } = req.body || {};
      const result = await candidateSellingLocationService.evaluateZoneCandidateSellingLocations(zoneId, {
        timeSlot,
        riderLat,
        riderLon,
      });

      return sendSuccess(res, result, "Zone candidates evaluated successfully");
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async getEvaluationSnapshot(req, res) {
    try {
      const { evaluationId } = req.params;
      const result = await candidateSellingLocationService.getEvaluationSnapshotById(evaluationId);

      return sendSuccess(res, result, "Evaluation snapshot retrieved successfully");
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async getEvaluationExplanation(req, res) {
    try {
      const { evaluationId } = req.params;
      const snapshot = await candidateSellingLocationService.getEvaluationSnapshotById(evaluationId);

      return sendSuccess(
        res,
        {
          evaluation_id: snapshot.evaluation_id,
          explanations: snapshot.explanations,
        },
        "Evaluation explanation retrieved successfully"
      );
    } catch (err) {
      return handleControllerError(res, err);
    }
  }

  async getEvaluationAudit(req, res) {
    try {
      const { evaluationId } = req.params;
      const snapshot = await candidateSellingLocationService.getEvaluationSnapshotById(evaluationId);

      return sendSuccess(
        res,
        {
          audit: snapshot.audit,
          criteria_specs: snapshot.criteria_specs,
          ideal_positive: snapshot.ideal_positive,
          ideal_negative: snapshot.ideal_negative,
          total_evaluated_candidates: snapshot.total_evaluated_candidates,
        },
        "Evaluation audit retrieved successfully"
      );
    } catch (err) {
      return handleControllerError(res, err);
    }
  }
}

export const candidateSellingLocationController = new CandidateSellingLocationController();
