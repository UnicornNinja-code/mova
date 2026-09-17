/*
 * StringSimilarity.js
 * Deterministic string normalization & similarity scoring engine for POI deduplication
 */

/**
 * Normalizes a string for deterministic comparison
 */
export function normalizePoiName(str = "") {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
    .replace(/[^\w\s]/g, " ") // Replace punctuation with space
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim();
}

/**
 * Calculates Levenshtein Distance between two normalized strings
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates Token Set Similarity ratio
 */
export function tokenSetSimilarity(norm1, norm2) {
  const tokens1 = new Set(norm1.split(" ").filter((t) => t.length > 0));
  const tokens2 = new Set(norm2.split(" ").filter((t) => t.length > 0));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Deterministic string similarity score (0.0 to 1.0)
 */
export function calculateStringSimilarity(name1 = "", name2 = "") {
  const norm1 = normalizePoiName(name1);
  const norm2 = normalizePoiName(name2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;

  const levDist = levenshteinDistance(norm1, norm2);
  const levSimilarity = 1.0 - levDist / maxLen;

  const tokenSim = tokenSetSimilarity(norm1, norm2);

  // Return maximum of Levenshtein similarity and Token similarity
  return Math.max(levSimilarity, tokenSim);
}
