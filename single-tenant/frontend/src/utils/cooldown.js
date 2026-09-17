/*
 * cooldown.js
 * Frontend Cooldown State Management for Rate-Limited Actions (e.g. Forgot Password)
 * Persisted in sessionStorage across page reloads.
 */

const FORGOT_PW_STORAGE_KEY = "mova_forgot_pw_cooldown_until";

/**
 * Set cooldown expiration timestamp in sessionStorage
 * @param {number} seconds - Duration in seconds
 */
export function setForgotPasswordCooldown(seconds = 120) {
  if (typeof window === "undefined") return;
  const expiresAt = Date.now() + seconds * 1000;
  sessionStorage.setItem(FORGOT_PW_STORAGE_KEY, expiresAt.toString());
}

/**
 * Get remaining cooldown in seconds from sessionStorage
 * @returns {number} Remaining seconds (0 if expired)
 */
export function getRemainingForgotPasswordCooldown() {
  if (typeof window === "undefined") return 0;
  const expiresAt = sessionStorage.getItem(FORGOT_PW_STORAGE_KEY);
  if (!expiresAt) return 0;

  const remaining = Math.ceil((parseInt(expiresAt, 10) - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * Format remaining seconds into mm:ss format (e.g. 1:45)
 * @param {number} totalSeconds
 * @returns {string} Formatted time string
 */
export function formatCooldownTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "0:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}
