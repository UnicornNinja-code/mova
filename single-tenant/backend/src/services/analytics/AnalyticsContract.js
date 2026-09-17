export const ANALYTICS_VERSION = "MOVA-ANALYTICS-v1.0";

export const DATA_STATUS = Object.freeze({
  COMPLETE: "COMPLETE",
  NO_DATA: "NO_DATA",
  PARTIAL: "PARTIAL",
  DEGRADED: "DEGRADED",
});

export const POPULATION_SCOPES = Object.freeze({
  ALL_ASSIGNED: "ALL_ASSIGNED",
  CHECKED_IN: "CHECKED_IN",
  OPERATING: "OPERATING",
  TRANSACTING: "TRANSACTING",
});

export const TIME_RANGE_PRESETS = Object.freeze({
  TODAY: "today",
  YESTERDAY: "yesterday",
  LAST_7_DAYS: "7d",
  LAST_30_DAYS: "30d",
  THIS_MONTH: "month",
  CUSTOM: "custom",
});

export function formatMetric(value, sampleSize = 0, unit = "") {
  const num = typeof value === "number" ? value : parseFloat(value);
  const isValidNumber = !isNaN(num);

  if (!isValidNumber || sampleSize === 0) {
    return {
      value: 0,
      formatted: unit === "Rp" ? "Rp 0" : unit === "%" ? "0.00%" : "0",
      sample_size: sampleSize,
      data_status: DATA_STATUS.NO_DATA,
      unit,
    };
  }

  let formatted = String(num);
  if (unit === "Rp") {
    formatted = `Rp ${Math.round(num).toLocaleString("id-ID")}`;
  } else if (unit === "%") {
    formatted = `${num.toFixed(2)}%`;
  } else if (unit === "min") {
    formatted = `${num.toFixed(1)} min`;
  }

  return {
    value: parseFloat(num.toFixed(4)),
    formatted,
    sample_size: sampleSize,
    data_status: DATA_STATUS.COMPLETE,
    unit,
  };
}
