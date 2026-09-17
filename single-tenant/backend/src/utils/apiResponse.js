/*
 *   Copyright (c) 2026
 *   All rights reserved.
 *   apiResponse.js — Universal Response Envelope Standardizer
 *   Guarantees SSOT contract consistency across all backend endpoints with backward compatibility.
 */

/**
 * Send standard successful single-item or collection response.
 *
 * @param {import("express").Response} res - Express response object
 * @param {*} data - Payload data to return
 * @param {string} [message="Request successful"] - Descriptive success message
 * @param {number} [statusCode=200] - HTTP status code
 * @param {Object} [extra={}] - Additional top-level fields for backward compatibility
 */
export const sendSuccess = (
  res,
  data,
  message = "Request successful",
  statusCode = 200,
  extra = {}
) => {
  return res.status(statusCode).json({
    success: true,
    status: "success",
    statusCode,
    message,
    msg: message, // Backward-compatible alias
    data,
    ...extra,
  });
};

/**
 * Send standard paginated collection response.
 *
 * @param {import("express").Response} res - Express response object
 * @param {Array} items - Array of records
 * @param {Object} pagination - Pagination metadata
 * @param {number} [pagination.page=1] - Current page
 * @param {number} [pagination.limit=20] - Records per page
 * @param {number} [pagination.total_records=0] - Total count of matching records in database
 * @param {number} [pagination.total_pages=1] - Total number of pages
 * @param {string} [message="Data retrieved successfully"] - Descriptive message
 * @param {number} [statusCode=200] - HTTP status code
 * @param {Object} [extra={}] - Additional top-level fields for backward compatibility
 */
export const sendPaginated = (
  res,
  items = [],
  pagination = {},
  message = "Data retrieved successfully",
  statusCode = 200,
  extra = {}
) => {
  const page = Number(pagination.page || 1);
  const limit = Number(pagination.limit || items.length || 20);
  const total_records = Number(
    pagination.total_records !== undefined
      ? pagination.total_records
      : pagination.total !== undefined
      ? pagination.total
      : items.length
  );
  const total_pages = Number(
    pagination.total_pages !== undefined
      ? pagination.total_pages
      : Math.ceil(total_records / (limit || 1)) || 1
  );

  return res.status(statusCode).json({
    success: true,
    status: "success",
    statusCode,
    message,
    msg: message, // Backward-compatible alias
    count: items.length, // Backward-compatible alias
    data: items,
    pagination: {
      page,
      limit,
      total_records,
      total_pages,
    },
    ...extra,
  });
};

/**
 * Send standard error response with UI notice and validation metadata.
 *
 * @param {import("express").Response} res - Express response object
 * @param {string} [message="Internal server error"] - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @param {Array|Object} [errors=null] - Validation errors or stack trace details
 * @param {Object} [ui_notice=null] - Formatted UI toast notification object
 */
export const sendError = (
  res,
  message = "Internal server error",
  statusCode = 500,
  errors = null,
  ui_notice = null
) => {
  const responsePayload = {
    success: false,
    status: "error",
    statusCode,
    message,
    msg: message, // Backward-compatible alias
  };

  if (errors) {
    responsePayload.errors = errors;
  }

  if (ui_notice) {
    responsePayload.ui_notice = ui_notice;
  } else if (statusCode >= 400 && statusCode < 500) {
    responsePayload.ui_notice = {
      type: statusCode === 429 ? "warning" : "error",
      title: statusCode === 429 ? "Batas Request" : "Permintaan Gagal",
      message,
    };
  }

  return res.status(statusCode).json(responsePayload);
};

export default {
  sendSuccess,
  sendPaginated,
  sendError,
};
