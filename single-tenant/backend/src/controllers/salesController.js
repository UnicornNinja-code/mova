import { salesService } from "../services/sales/SalesService.js";
import { riderOperationalService } from "../services/rider/RiderOperationalService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

const handleControllerError = (res, error, defaultStatus = 500) => {
  const statusCode = error.statusCode || defaultStatus;
  return sendError(res, error.message || "Internal server error", statusCode);
};

export const getSalesOverview = async (req, res) => {
  try {
    const { start_date, end_date, zone_id, rider_id, product_id } = req.query;
    const overview = await salesService.getSalesOverview({
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
      riderId: rider_id,
      productId: product_id,
    });
    return sendSuccess(res, overview, "Ringkasan penjualan berhasil dimuat.", 200, { data: overview });
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

    return sendSuccess(res, result.sales, "Riwayat penjualan rider berhasil dimuat.", 200, {
      data: result.sales,
      total_revenue: result.total_revenue,
      pagination: result.pagination,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
