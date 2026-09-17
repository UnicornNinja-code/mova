/*
 *   Copyright (c) 2026
 *   All rights reserved.
 *   api.js — Single Source of Truth Frontend Data Types & Contract Schemas
 *   Provides comprehensive JSDoc definitions & runtime helper functions for UI components.
 */

/**
 * @typedef {'SUPERADMIN' | 'MANAGEMENT' | 'SUPERVISOR' | 'RIDER'} UserRole
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} id - Unique identifier (UUID)
 * @property {string} username - User login handle
 * @property {string} name - Full human name
 * @property {string} email - Verified email address
 * @property {UserRole} role - RBAC system role
 * @property {string|null} [phone] - Contact phone number
 * @property {boolean} is_active - Account operational state
 * @property {boolean} first_login - Flag indicating password change is required
 * @property {string|null} [birth_date] - Date of birth (YYYY-MM-DD)
 * @property {string|null} [avatar_url] - URL to profile photo
 */

/**
 * @typedef {Object} PaginationMeta
 * @property {number} page - Current active page number (1-indexed)
 * @property {number} limit - Records per page
 * @property {number} total_records - Total count of matching database rows
 * @property {number} total_pages - Total calculated pages
 */

/**
 * @template T
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Boolean indicator of success
 * @property {string} [status] - "success" | "error"
 * @property {string} [message] - Human-readable status message
 * @property {string} [msg] - Backward-compatible message alias
 * @property {T} data - Main payload payload
 * @property {PaginationMeta} [pagination] - Pagination metadata for lists
 */

/**
 * @typedef {Object} DashboardKPISummary
 * @property {number} total_revenue_today - Total gross revenue in IDR today
 * @property {number} total_active_riders - Riders currently clocked in
 * @property {number} total_zones_covered - Active zones staffed
 * @property {number} fleet_utilization_rate - Percentage of armada deployed (0-100)
 * @property {number} revenue_trend_percentage - Delta compared to yesterday (+/-%)
 */

/**
 * @typedef {Object} SalesTrendPoint
 * @property {string} date - Date label (YYYY-MM-DD)
 * @property {number} revenue - Total revenue for the time bucket
 * @property {number} cups_sold - Total volume of cups sold
 * @property {number} transactions - Count of orders completed
 */

/**
 * @typedef {Object} GeoJSONPolygonGeometry
 * @property {'Polygon'} type
 * @property {number[][][]} coordinates - Array of LinearRings: [[[lng, lat], ...]]
 */

/**
 * @typedef {Object} GeoJSONPointGeometry
 * @property {'Point'} type
 * @property {[number, number]} coordinates - [Longitude, Latitude]
 */

/**
 * @typedef {Object} ZoneFeature
 * @property {string} id - Zone ID
 * @property {string} name - Zone Name (e.g. "Zona Alun-Alun Sidoarjo")
 * @property {'ACTIVE' | 'INACTIVE' | 'RESTRICTED'} status
 * @property {number} max_capacity - Maximum concurrent riders
 * @property {number} current_riders_count - Currently assigned riders
 * @property {number} [dss_score] - TOPSIS relative closeness score (0.000 - 1.000)
 * @property {GeoJSONPolygonGeometry} geometry - PostGIS Polygon geometry
 */

/**
 * Helper to compute user initials for UI avatar fallback
 * @param {string} [name="User"]
 * @returns {string} Two-letter uppercase initials (e.g. "Super Admin" -> "SA")
 */
export function getInitials(name = "User") {
  if (!name || typeof name !== "string") return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Helper to format currency into Indonesian Rupiah (IDR)
 * @param {number} amount
 * @returns {string} Formatted string (e.g. "Rp 1.500.000")
 */
export function formatIDR(amount = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
