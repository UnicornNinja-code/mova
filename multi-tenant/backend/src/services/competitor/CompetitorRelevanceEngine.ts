/*
 * CompetitorRelevanceEngine.ts
 * Pure Mathematical Relevance Calculation Engine for Competitor Characterization
 */

export interface RelevanceInput {
  priceScore: number;
  categoryMatch: boolean;
  modelMatch: boolean;
  weights?: {
    wp?: number; // Price weight (default 0.50)
    wc?: number; // Category weight (default 0.30)
    wm?: number; // Business model weight (default 0.20)
  };
  threshold?: number; // Relevance cutoff (default 0.40)
}

export interface RelevanceOutput {
  relevanceScore: number;
  isRelevant: boolean;
  details: {
    weightedPrice: number;
    weightedCategory: number;
    weightedModel: number;
  };
}

/**
 * Pure function: Menghitung skor relevansi kompetitor (R_i: 0.0 - 1.0)
 * Formula: R_i = (wp * S_price) + (wc * I_cat) + (wm * I_model)
 * Cutoff: R_i >= threshold (default 0.40)
 */
export function calculateCompetitorRelevance(input: RelevanceInput): RelevanceOutput {
  const wp = input.weights?.wp ?? 0.50;
  const wc = input.weights?.wc ?? 0.30;
  const wm = input.weights?.wm ?? 0.20;
  const threshold = input.threshold ?? 0.40;

  // Clamped price score
  const priceScore = Math.min(1.0, Math.max(0.0, input.priceScore));
  const categoryScore = input.categoryMatch ? 1.0 : 0.0;
  const modelScore = input.modelMatch ? 1.0 : 0.0;

  const weightedPrice = Number((wp * priceScore).toFixed(4));
  const weightedCategory = Number((wc * categoryScore).toFixed(4));
  const weightedModel = Number((wm * modelScore).toFixed(4));

  const totalScore = Number((weightedPrice + weightedCategory + weightedModel).toFixed(4));
  const clampedScore = Math.min(1.0, Math.max(0.0, totalScore));

  return {
    relevanceScore: clampedScore,
    isRelevant: clampedScore >= threshold,
    details: {
      weightedPrice,
      weightedCategory,
      weightedModel,
    },
  };
}
