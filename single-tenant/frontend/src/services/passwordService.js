/**
 * passwordService.js
 * Centralized service & utilities for password validation, policy checks, and matching calculations.
 * Strictly adheres to MOVA Enterprise Security Baseline.
 */

export const PASSWORD_RULES = [
  { id: "length", label: "Minimal 8 karakter", test: (p) => (p || "").length >= 8 },
  { id: "uppercase", label: "Minimal 1 huruf besar (A-Z)", test: (p) => /[A-Z]/.test(p || "") },
  { id: "number", label: "Minimal 1 angka (0-9)", test: (p) => /[0-9]/.test(p || "") },
  { id: "special", label: "Minimal 1 karakter khusus / simbol (@$!%*?&#)", test: (p) => /[^A-Za-z0-9]/.test(p || "") },
];

/**
 * Validates a password against enterprise criteria and returns detailed score & criteria status.
 * @param {string} password 
 * @returns {{
 *   score: number,
 *   isValid: boolean,
 *   criteria: Record<string, boolean>,
 *   passedCount: number,
 *   totalCount: number,
 *   strengthLabel: string,
 *   strengthColor: string
 * }}
 */
export function validatePasswordPolicy(password = "") {
  const criteria = {};
  let passedCount = 0;

  for (const rule of PASSWORD_RULES) {
    const passed = rule.test(password);
    criteria[rule.id] = passed;
    if (passed) passedCount++;
  }

  const totalCount = PASSWORD_RULES.length;
  const isValid = passedCount === totalCount;
  const score = passedCount; // 0 to 4

  let strengthLabel = "Sangat Lemah";
  let strengthColor = "hsl(var(--destructive))";

  if (score === 1) {
    strengthLabel = "Sangat Lemah";
    strengthColor = "hsl(var(--destructive))";
  } else if (score === 2) {
    strengthLabel = "Cukup";
    strengthColor = "hsl(var(--warning))";
  } else if (score === 3) {
    strengthLabel = "Kuat";
    strengthColor = "hsl(var(--primary))";
  } else if (score === 4) {
    strengthLabel = "Sangat Kuat";
    strengthColor = "hsl(var(--success))";
  }

  return {
    score,
    isValid,
    criteria,
    passedCount,
    totalCount,
    strengthLabel,
    strengthColor,
  };
}

/**
 * Validates whether two password strings match.
 * @param {string} password 
 * @param {string} confirmPassword 
 * @returns {{ isMatch: boolean, isEmpty: boolean }}
 */
export function checkPasswordMatch(password = "", confirmPassword = "") {
  if (!confirmPassword || confirmPassword.length === 0) {
    return { isMatch: false, isEmpty: true };
  }
  return {
    isMatch: password === confirmPassword,
    isEmpty: false,
  };
}

export default {
  PASSWORD_RULES,
  validatePasswordPolicy,
  checkPasswordMatch,
};
