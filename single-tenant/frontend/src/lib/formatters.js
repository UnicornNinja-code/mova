/**
 * formatters.js
 * Standardized data presentation helpers for MOVA
 */

export function formatRupiah(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Rp0";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDistance(meters) {
  if (meters === null || meters === undefined || Number.isNaN(Number(meters))) {
    return "0 m";
  }
  const m = Number(meters);
  if (m >= 1000) {
    return `${(m / 1000).toFixed(2)} km`;
  }
  return `${Math.round(m)} m`;
}

export function formatDateTime(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatPercentage(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) {
    return "0%";
  }
  return `${(Number(ratio) * 100).toFixed(1)}%`;
}
