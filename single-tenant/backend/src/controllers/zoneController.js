import { zoneService } from "../services/zoneService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const getZoneConfig = async (req, res) => {
  try {
    const config = await zoneService.getZoneConfig();
    return sendSuccess(res, config, "Konfigurasi zona berhasil dimuat.", 200, config);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getAllZones = async (req, res) => {
  try {
    const { status, search } = req.query;
    const result = await zoneService.getAllZones({ status, search });
    return sendSuccess(res, result.zones || result, "Daftar zona berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await zoneService.getZoneById(id);
    return sendSuccess(res, zone, "Detail zona berhasil dimuat.", 200, { zone });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const validateZone = async (req, res) => {
  try {
    const { polygon, name, exclude_id } = req.body;
    const validation = await zoneService.preValidateZonePolygon({
      polygon,
      name,
      excludeId: exclude_id || null,
    });
    return sendSuccess(res, validation, "Validasi geometri poligon berhasil.", 200, validation);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const createZone = async (req, res) => {
  try {
    const { name, description, max_capacity, status, polygon } = req.body;
    const newZone = await zoneService.createZone({
      name,
      description,
      max_capacity,
      status,
      polygon,
    });
    return sendSuccess(res, newZone, "Zona operasional berhasil ditambahkan", 201, { zone: newZone });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, max_capacity, status, polygon } = req.body;
    const updated = await zoneService.updateZone(id, {
      name,
      description,
      max_capacity,
      status,
      polygon,
    });
    return sendSuccess(res, updated, "Data zona operasional berhasil diperbarui", 200, { zone: updated });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateZoneStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await zoneService.updateZoneStatus(id, status);
    return sendSuccess(res, updated, "Status zona operasional berhasil diubah", 200, { zone: updated });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateZoneCapacity = async (req, res) => {
  try {
    const { id } = req.params;
    const { max_capacity } = req.body;
    const updated = await zoneService.updateZoneCapacity(id, max_capacity);
    return sendSuccess(res, updated, "Kapasitas kuota zona operasional berhasil diubah", 200, { zone: updated });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await zoneService.deleteZone(id);
    return sendSuccess(res, deleted, "Zona operasional berhasil dihapus", 200, { zone: deleted });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
