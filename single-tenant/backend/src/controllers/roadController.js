import { roadService, syncTollRoadsService, syncProtocolRoadsService } from "../services/roadService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export class RoadController {
  async getProtocolRoads(req, res) {
    try {
      const geojson = await roadService.getProtocolRoadsGeoJson();
      return sendSuccess(res, geojson, "Data jalan protokol berhasil dimuat.", 200, geojson);
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async getTollRoads(req, res) {
    try {
      const geojson = await roadService.getTollRoadsGeoJson();
      return sendSuccess(res, geojson, "Data jalan tol berhasil dimuat.", 200, geojson);
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async syncProtocolRoads(req, res) {
    try {
      const result = await syncProtocolRoadsService(req.body || {});
      return sendSuccess(res, result, "Sinkronisasi jalan protokol berhasil.", 200, result);
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  async syncTollRoads(req, res) {
    try {
      const result = await syncTollRoadsService(req.body || {});
      return sendSuccess(res, result, "Sinkronisasi jalan tol berhasil.", 200, result);
    } catch (error) {
      return handleControllerError(res, error);
    }
  }
}

export const roadController = new RoadController();
