/*
 * BwmWeightService.ts
 * Clean Architecture Singleton Engine for BWM Weight Optimization & Terminal Logging in TypeScript
 * References: Rezaei, J. (2015/2016). Best-worst multi-criteria decision-making method.
 */

import solver from "javascript-lp-solver";

const REZAEI_CI_TABLE: Record<number, number> = {
  1: 0.0,
  2: 0.44,
  3: 1.0,
  4: 1.63,
  5: 2.3,
  6: 3.0,
  7: 3.73,
  8: 4.47,
  9: 5.23,
};

export interface BwmCriteriaInput {
  id: string | number;
  name: string;
  code?: string;
}

export interface BwmInputParams {
  best_criteria_id: string | number;
  worst_criteria_id: string | number;
  best_to_others: Record<string, number>;
  worst_to_others: Record<string, number>;
  criteria_list: BwmCriteriaInput[];
}

export interface BwmCalculationOutput {
  best_criteria_id: string | number;
  worst_criteria_id: string | number;
  a_BW: number;
  weights: Record<string, number>;
  xi_star: number;
  ci: number;
  consistency_ratio: number;
  is_consistent: boolean;
  formatted_details: Array<{
    id: string | number;
    code: string;
    name: string;
    weight: number;
    weight_percentage: number;
  }>;
  mode?: string;
}

export class BwmWeightService {
  private static instance: BwmWeightService | null = null;

  constructor() {
    if (BwmWeightService.instance) {
      return BwmWeightService.instance;
    }
    BwmWeightService.instance = this;
  }

  public static getInstance(): BwmWeightService {
    if (!BwmWeightService.instance) {
      BwmWeightService.instance = new BwmWeightService();
    }
    return BwmWeightService.instance;
  }

  /**
   * Calculate BWM Optimal Weights W* and Consistency Ratio (CR) with Step-by-Step Terminal Logging
   */
  public calculateBwmWeights(inputData: BwmInputParams): BwmCalculationOutput {
    const {
      best_criteria_id,
      worst_criteria_id,
      best_to_others,
      worst_to_others,
      criteria_list,
    } = inputData;

    // --- STEP 1: VALIDATION ---
    if (!best_criteria_id || !worst_criteria_id) {
      const error: any = new Error("Kriteria Terbaik (Best) dan Terburuk (Worst) wajib dipilih.");
      error.statusCode = 400;
      throw error;
    }

    if (best_criteria_id === worst_criteria_id) {
      const error: any = new Error("Kriteria Terbaik (Best) dan Terburuk (Worst) tidak boleh kriteria yang sama.");
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(criteria_list) || criteria_list.length < 2) {
      const error: any = new Error("Himpunan kriteria minimal berjumlah 2 item.");
      error.statusCode = 400;
      throw error;
    }

    const n = criteria_list.length;
    const bestCriteria = criteria_list.find((c) => c.id === best_criteria_id);
    const worstCriteria = criteria_list.find((c) => c.id === worst_criteria_id);

    if (!bestCriteria || !worstCriteria) {
      const error: any = new Error("Kriteria Best atau Worst tidak ditemukan dalam daftar kriteria.");
      error.statusCode = 400;
      throw error;
    }

    console.log("\n================================================================================");
    console.log("🚀 [BWM ENGINE] MEMULAI KOMPUTASI BOBOT BEST-WORST METHOD (Rezaei, 2016)");
    console.log("================================================================================");
    console.log(`📌 Kriteria Terbaik  (C_B) : [${bestCriteria.code || bestCriteria.name}] - ${bestCriteria.name}`);
    console.log(`📌 Kriteria Terburuk (C_W) : [${worstCriteria.code || worstCriteria.name}] - ${worstCriteria.name}`);
    console.log("--------------------------------------------------------------------------------");

    // --- STEP 3: PREFERENCE VECTORS A_B & A_W ---
    const a_B: Record<string, number> = {};
    const a_W: Record<string, number> = {};

    criteria_list.forEach((c) => {
      let ratingB = parseFloat(String(best_to_others[c.id]));
      if (c.id === best_criteria_id) ratingB = 1;
      if (isNaN(ratingB) || ratingB < 1 || ratingB > 9) ratingB = 1;
      a_B[c.id] = ratingB;
    });

    criteria_list.forEach((c) => {
      let ratingW = parseFloat(String(worst_to_others[c.id]));
      if (c.id === worst_criteria_id) ratingW = 1;
      if (isNaN(ratingW) || ratingW < 1 || ratingW > 9) ratingW = 1;
      a_W[c.id] = ratingW;
    });

    // --- STEP 4: CONSTRUCT LINEAR PROGRAMMING MODEL ---
    const lpModel: any = {
      optimize: "xi",
      opType: "min",
      constraints: {
        sum_weights: { equal: 1 },
      },
      variables: {},
    };

    criteria_list.forEach((c) => {
      lpModel.variables[c.id] = { sum_weights: 1 };
    });
    lpModel.variables["xi"] = { optimize: 1 };

    let constraintIdx = 1;
    criteria_list.forEach((c) => {
      const a_Bj = a_B[c.id];

      const cName1 = `cb_pos_${constraintIdx}`;
      lpModel.constraints[cName1] = { max: 0 };
      lpModel.variables[best_criteria_id][cName1] = (lpModel.variables[best_criteria_id][cName1] || 0) + 1;
      lpModel.variables[c.id][cName1] = (lpModel.variables[c.id][cName1] || 0) - a_Bj;
      lpModel.variables["xi"][cName1] = -1;

      const cName2 = `cb_neg_${constraintIdx}`;
      lpModel.constraints[cName2] = { max: 0 };
      lpModel.variables[best_criteria_id][cName2] = (lpModel.variables[best_criteria_id][cName2] || 0) - 1;
      lpModel.variables[c.id][cName2] = (lpModel.variables[c.id][cName2] || 0) + a_Bj;
      lpModel.variables["xi"][cName2] = -1;

      const a_jW = a_W[c.id];

      const cName3 = `cw_pos_${constraintIdx}`;
      lpModel.constraints[cName3] = { max: 0 };
      lpModel.variables[c.id][cName3] = (lpModel.variables[c.id][cName3] || 0) + 1;
      lpModel.variables[worst_criteria_id][cName3] = (lpModel.variables[worst_criteria_id][cName3] || 0) - a_jW;
      lpModel.variables["xi"][cName3] = -1;

      const cName4 = `cw_neg_${constraintIdx}`;
      lpModel.constraints[cName4] = { max: 0 };
      lpModel.variables[c.id][cName4] = (lpModel.variables[c.id][cName4] || 0) - 1;
      lpModel.variables[worst_criteria_id][cName4] = (lpModel.variables[worst_criteria_id][cName4] || 0) + a_jW;
      lpModel.variables["xi"][cName4] = -1;

      constraintIdx++;
    });

    // --- STEP 5: EXECUTE SIMPLEX LP SOLVER ---
    const solution: any = solver.Solve(lpModel);

    if (!solution || !solution.feasible) {
      console.warn("⚠️ LP Solver infeasible, menggunakan formulasi aproksimasi fallback...");
      return this.calculateApproximationFallback(inputData);
    }

    const xi_star = Math.max(0, parseFloat(String(solution.result || solution.xi || 0)));

    // --- STEP 6: NORMALIZE OPTIMAL WEIGHTS ---
    const rawWeights: Record<string, number> = {};
    let sumRaw = 0;

    criteria_list.forEach((c) => {
      const val = Math.max(0, parseFloat(String(solution[c.id] || 0)));
      rawWeights[c.id] = val;
      sumRaw += val;
    });

    const normalizedWeights: Record<string, number> = {};
    criteria_list.forEach((c) => {
      normalizedWeights[c.id] = sumRaw > 0 ? rawWeights[c.id] / sumRaw : 1 / n;
    });

    // --- STEP 7: CONSISTENCY TEST (CR = xi* / CI) ---
    const a_BW = a_B[worst_criteria_id] || 1;
    const ci = REZAEI_CI_TABLE[Math.round(a_BW)] || 0.0;

    let consistencyRatio = 0;
    if (a_BW === 1 || ci === 0) {
      consistencyRatio = 0.0;
    } else {
      consistencyRatio = xi_star / ci;
    }

    const isConsistent = consistencyRatio <= 0.1;

    return {
      best_criteria_id,
      worst_criteria_id,
      a_BW,
      weights: normalizedWeights,
      xi_star,
      ci,
      consistency_ratio: consistencyRatio,
      is_consistent: isConsistent,
      formatted_details: criteria_list.map((c) => ({
        id: c.id,
        code: c.code || c.name,
        name: c.name,
        weight: normalizedWeights[c.id],
        weight_percentage: parseFloat((normalizedWeights[c.id] * 100).toFixed(2)),
      })),
    };
  }

  /**
   * Approximation Fallback Formula if LP Solver fails
   */
  public calculateApproximationFallback(inputData: BwmInputParams): BwmCalculationOutput {
    const { best_criteria_id, worst_criteria_id, best_to_others, worst_to_others, criteria_list } = inputData;
    const n = criteria_list.length;

    const weights: Record<string, number> = {};
    let sumW = 0;

    criteria_list.forEach((c) => {
      const a_Bj = parseFloat(String(best_to_others[c.id])) || 1;
      const a_jW = parseFloat(String(worst_to_others[c.id])) || 1;
      const w_j = 0.5 * (1 / a_Bj + a_jW / (parseFloat(String(best_to_others[worst_criteria_id])) || 1));
      weights[c.id] = w_j;
      sumW += w_j;
    });

    criteria_list.forEach((c) => {
      weights[c.id] = sumW > 0 ? weights[c.id] / sumW : 1 / n;
    });

    return {
      best_criteria_id,
      worst_criteria_id,
      a_BW: 1,
      weights,
      xi_star: 0,
      ci: 0,
      consistency_ratio: 0,
      is_consistent: true,
      formatted_details: criteria_list.map((c) => ({
        id: c.id,
        code: c.code || c.name,
        name: c.name,
        weight: weights[c.id],
        weight_percentage: parseFloat((weights[c.id] * 100).toFixed(2)),
      })),
      mode: "APPROXIMATION_FALLBACK",
    };
  }
}

export const bwmWeightService = BwmWeightService.getInstance();
