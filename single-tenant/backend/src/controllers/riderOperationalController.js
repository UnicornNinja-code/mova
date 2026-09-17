import { riderOperationalService } from "../services/rider/RiderOperationalService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode, error.details || null);
};

export const getActiveSession = async (req, res) => {
  try {
    const riderId = req.user?.id || req.query?.rider_id;
    const result = await riderOperationalService.getRiderActiveSession(riderId);
    return sendSuccess(res, result, "Sesi aktif rider berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getHubArmadas = async (req, res) => {
  try {
    const riderId = req.user?.id || req.query?.rider_id;
    const result = await riderOperationalService.getHubArmadaCatalog(riderId);
    return sendSuccess(res, result, "Katalog armada hub berhasil dimuat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const holdArmada = async (req, res) => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const { armada_id } = req.body;

    const result = await riderOperationalService.inspectAndHoldArmada({
      riderId,
      armadaId: armada_id,
    });
    return sendSuccess(res, result, "Unit armada berhasil di-hold sementara.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const cancelHoldArmada = async (req, res) => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const { armada_id } = req.body;

    const result = await riderOperationalService.cancelArmadaHold({
      riderId,
      armadaId: armada_id,
    });
    return sendSuccess(res, result, "Hold armada berhasil dibatalkan.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const confirmClaimArmada = async (req, res) => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const { armada_id } = req.body;

    const result = await riderOperationalService.confirmArmadaClaim({
      riderId,
      armadaId: armada_id,
    });
    return sendSuccess(res, result, "Unit armada berhasil diklaim.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const checkInZone = async (req, res) => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const lat = req.body.latitude !== undefined ? req.body.latitude : req.body.lat;
    const lon = req.body.longitude !== undefined ? req.body.longitude : req.body.lon;

    const result = await riderOperationalService.checkInToZone({
      riderId,
      lat,
      lon,
    });
    return sendSuccess(res, result, "Check-in ke zona tugas berhasil dicatat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const recordSale = async (req, res) => {
  try {
    const riderId = req.user.id;
    const productId = req.body.product_id || req.body.productId;
    const quantity = req.body.quantity !== undefined ? req.body.quantity : req.body.qty;
    const lat = req.body.latitude || req.body.lat;
    const lon = req.body.longitude || req.body.lon;

    const result = await riderOperationalService.recordProductSale({
      riderId,
      productId,
      quantity,
      lat,
      lon,
    });
    return sendSuccess(res, result, "Data transaksi penjualan berhasil dicatat.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getMySales = async (req, res) => {
  try {
    const riderId = req.user.id;
    const { date, page, limit } = req.query;

    const result = await riderOperationalService.getMySalesHistory({
      riderId,
      date,
      page,
      limit,
    });
    return sendSuccess(res, result.sales, "Riwayat transaksi penjualan berhasil dimuat.", 200, {
      data: result.sales,
      total_revenue: result.total_revenue,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const checkoutSession = async (req, res) => {
  try {
    const riderId = req.user.id;
    const returnStatus = req.body.return_status || req.body.returnStatus || "ACTIVE";
    const notes = req.body.notes;

    const result = await riderOperationalService.checkoutAndReturnArmada({
      riderId,
      returnStatus,
      notes,
    });
    return sendSuccess(res, result, "Sesi operasional berhasil diselesaikan.", 200, result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const lockSpot = async (req, res) => {
  try {
    const riderId = req.user?.id || req.body?.rider_id;
    const { spot_id = "SPOT-001", spot_name = "Spot Rekomendasi Utama", latitude, longitude } = req.body;
    const payload = {
      rider_id: riderId,
      spot_id,
      spot_name,
      latitude,
      longitude,
      locked_at: new Date().toISOString(),
    };
    return sendSuccess(res, payload, "Titik penjualan terbaik berhasil dikunci untuk sesi aktif Anda", 200, {
      data: payload,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
