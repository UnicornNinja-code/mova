import { armadaService } from "../services/armadaService.js";
import { riderOperationalService } from "../services/rider/RiderOperationalService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const getAllArmadas = async (req, res) => {
  try {
    const { status, type } = req.query;
    const result = await armadaService.getAllArmadas({ status, type });
    return sendSuccess(res, result.armadas || result, "Daftar unit armada berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getArmadaById = async (req, res) => {
  try {
    const { id } = req.params;
    const armada = await armadaService.getArmadaById(id);
    return sendSuccess(res, armada, "Detail armada berhasil dimuat.", 200, { armada });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const createArmada = async (req, res) => {
  try {
    const { code, name, type, status } = req.body;
    const newArmada = await armadaService.createArmada({ code, name, type, status });
    return sendSuccess(res, newArmada, "Unit armada berhasil ditambahkan", 201, { armada: newArmada });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const updateArmada = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, status, current_rider_id } = req.body;

    const updated = await armadaService.updateArmada(id, {
      code,
      type,
      status,
      current_rider_id,
    });

    return sendSuccess(res, updated, "Data unit armada berhasil diperbarui", 200, { armada: updated });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const deleteArmada = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await armadaService.deleteArmada(id);
    return sendSuccess(res, deleted, "Unit armada berhasil dihapus", 200, { armada: deleted });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const holdArmada = async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.user?.id || req.body?.rider_id;

    const result = await riderOperationalService.inspectAndHoldArmada({
      riderId,
      armadaId: id,
    });
    return sendSuccess(res, result, "Unit armada berhasil di-hold sementara.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const claimArmada = async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.user?.id || req.body?.rider_id;

    const result = await riderOperationalService.confirmArmadaClaim({
      riderId,
      armadaId: id,
    });
    return sendSuccess(res, result, "Unit armada berhasil diklaim.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const releaseArmada = async (req, res) => {
  try {
    const { id } = req.params;
    const riderId = req.user?.id || req.body?.rider_id;

    const result = await riderOperationalService.cancelArmadaHold({
      riderId,
      armadaId: id,
    });
    return sendSuccess(res, result, "Reservasi armada berhasil dibatalkan.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const setMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, cost } = req.body;
    const result = await armadaService.setMaintenance(id, { notes, cost });
    return sendSuccess(res, result, "Unit armada dialihkan ke status pemeliharaan", 200, { armada: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const releaseMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await armadaService.releaseMaintenance(id);
    return sendSuccess(res, result, "Unit armada telah selesai diservis dan siap digunakan", 200, { armada: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
