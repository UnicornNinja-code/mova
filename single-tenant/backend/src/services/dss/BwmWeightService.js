/*
 * BwmWeightService.js
 * Clean Architecture Singleton Engine for BWM Weight Optimization & Terminal Logging
 * References: Rezaei, J. (2015/2016). Best-worst multi-criteria decision-making method.
 * Optimized with Immutable CI Tables & Resilient Fallback Formulation.
 */

import solver from "javascript-lp-solver";

// Consistency Index (CI = xi_max) Table (Rezaei, 2015/2016) for a_BW in [1..9]
const REZAEI_CI_TABLE = Object.freeze({
  1: 0.00,
  2: 0.44,
  3: 1.00,
  4: 1.63,
  5: 2.30,
  6: 3.00,
  7: 3.73,
  8: 4.47,
  9: 5.23,
});

export class BwmWeightService {
  static instance = null;

  constructor() {
    if (BwmWeightService.instance) {
      return BwmWeightService.instance;
    }
    BwmWeightService.instance = this;
  }

  static getInstance() {
    if (!BwmWeightService.instance) {
      BwmWeightService.instance = new BwmWeightService();
    }
    return BwmWeightService.instance;
  }

  /**
   * Calculate BWM Optimal Weights W* and Consistency Ratio (CR) with Step-by-Step Terminal Logging
   * 
   * @param {Object} inputData
   * @param {string} inputData.best_criteria_id - Best Criteria ID (C_B)
   * @param {string} inputData.worst_criteria_id - Worst Criteria ID (C_W)
   * @param {Object} inputData.best_to_others - Key-value pair { [criteria_id]: rating (1..9) }
   * @param {Object} inputData.worst_to_others - Key-value pair { [criteria_id]: rating (1..9) }
   * @param {Array} inputData.criteria_list - Array of criteria objects [{ id, name, code }]
   */
  calculateBwmWeights(inputData) {
    const {
      best_criteria_id,
      worst_criteria_id,
      best_to_others = {},
      worst_to_others = {},
      criteria_list,
    } = inputData;

    // --- STEP 1: VALIDATION ---
    if (!best_criteria_id || !worst_criteria_id) {
      const error = new Error("Kriteria Terbaik (Best) dan Terburuk (Worst) wajib dipilih.");
      error.statusCode = 400;
      throw error;
    }

    if (best_criteria_id === worst_criteria_id) {
      const error = new Error("Kriteria Terbaik (Best) dan Terburuk (Worst) tidak boleh kriteria yang sama.");
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(criteria_list) || criteria_list.length < 2) {
      const error = new Error("Himpunan kriteria minimal berjumlah 2 item.");
      error.statusCode = 400;
      throw error;
    }

    const n = criteria_list.length;
    const bestCriteria = criteria_list.find((c) => c.id === best_criteria_id);
    const worstCriteria = criteria_list.find((c) => c.id === worst_criteria_id);

    if (!bestCriteria || !worstCriteria) {
      const error = new Error("Kriteria Best atau Worst tidak ditemukan dalam daftar kriteria.");
      error.statusCode = 400;
      throw error;
    }

    // --- STEP 2: CONSOLE LOG HEADER ---
    console.log("\n================================================================================");
    console.log("🚀 [BWM ENGINE] MEMULAI KOMPUTASI BOBOT BEST-WORST METHOD (Rezaei, 2016)");
    console.log("================================================================================");
    console.log(`📌 Kriteria Terbaik  (C_B) : [${bestCriteria.code || bestCriteria.name}] - ${bestCriteria.name}`);
    console.log(`📌 Kriteria Terburuk (C_W) : [${worstCriteria.code || worstCriteria.name}] - ${worstCriteria.name}`);
    console.log("--------------------------------------------------------------------------------");

    // --- STEP 3: PREFERENCE VECTORS A_B & A_W ---
    console.log("📥 Vektor Best-to-Others (A_B):");
    const a_B = {};
    const a_W = {};

    criteria_list.forEach((c) => {
      let ratingB = parseFloat(best_to_others[c.id]);
      if (c.id === best_criteria_id) ratingB = 1;
      if (isNaN(ratingB) || ratingB < 1 || ratingB > 9) ratingB = 1;
      a_B[c.id] = ratingB;
      console.log(`   • ${bestCriteria.code || bestCriteria.name} -> ${c.code || c.name} = ${ratingB}`);
    });

    console.log("\n📥 Vektor Others-to-Worst (A_W):");
    criteria_list.forEach((c) => {
      let ratingW = parseFloat(worst_to_others[c.id]);
      if (c.id === worst_criteria_id) ratingW = 1;
      if (isNaN(ratingW) || ratingW < 1 || ratingW > 9) ratingW = 1;
      a_W[c.id] = ratingW;
      console.log(`   • ${c.code || c.name} -> ${worstCriteria.code || worstCriteria.name} = ${ratingW}`);
    });

    // --- STEP 4: CONSTRUCT LINEAR PROGRAMMING MODEL ---
    console.log("\n⚙️ Memformulasi Model Optimasi Linier Min-Max (Minimasi ξ)...");

    const lpModel = {
      optimize: "xi",
      opType: "min",
      constraints: {
        sum_weights: { equal: 1 },
      },
      variables: {},
    };

    // Initialize variables (w1..wn, xi)
    criteria_list.forEach((c) => {
      lpModel.variables[c.id] = { sum_weights: 1 };
    });
    lpModel.variables["xi"] = { optimize: 1 };

    // Add Constraints for Best-to-Others: |w_B - a_Bj * w_j| <= xi
    let constraintIdx = 1;
    criteria_list.forEach((c) => {
      const a_Bj = a_B[c.id];
      
      // Constraint 1: w_B - a_Bj * w_j - xi <= 0
      const cName1 = `cb_pos_${constraintIdx}`;
      lpModel.constraints[cName1] = { max: 0 };
      lpModel.variables[best_criteria_id][cName1] = (lpModel.variables[best_criteria_id][cName1] || 0) + 1;
      lpModel.variables[c.id][cName1] = (lpModel.variables[c.id][cName1] || 0) - a_Bj;
      lpModel.variables["xi"][cName1] = -1;

      // Constraint 2: -w_B + a_Bj * w_j - xi <= 0
      const cName2 = `cb_neg_${constraintIdx}`;
      lpModel.constraints[cName2] = { max: 0 };
      lpModel.variables[best_criteria_id][cName2] = (lpModel.variables[best_criteria_id][cName2] || 0) - 1;
      lpModel.variables[c.id][cName2] = (lpModel.variables[c.id][cName2] || 0) + a_Bj;
      lpModel.variables["xi"][cName2] = -1;

      // Add Constraints for Others-to-Worst: |w_j - a_jW * w_W| <= xi
      const a_jW = a_W[c.id];

      // Constraint 3: w_j - a_jW * w_W - xi <= 0
      const cName3 = `cw_pos_${constraintIdx}`;
      lpModel.constraints[cName3] = { max: 0 };
      lpModel.variables[c.id][cName3] = (lpModel.variables[c.id][cName3] || 0) + 1;
      lpModel.variables[worst_criteria_id][cName3] = (lpModel.variables[worst_criteria_id][cName3] || 0) - a_jW;
      lpModel.variables["xi"][cName3] = -1;

      // Constraint 4: -w_j + a_jW * w_W - xi <= 0
      const cName4 = `cw_neg_${constraintIdx}`;
      lpModel.constraints[cName4] = { max: 0 };
      lpModel.variables[c.id][cName4] = (lpModel.variables[c.id][cName4] || 0) - 1;
      lpModel.variables[worst_criteria_id][cName4] = (lpModel.variables[worst_criteria_id][cName4] || 0) + a_jW;
      lpModel.variables["xi"][cName4] = -1;

      constraintIdx++;
    });

    // --- STEP 5: EXECUTE SIMPLEX LP SOLVER ---
    console.log("🧮 Menjalankan Algoritma Simplex (LP Solver)...");
    const solution = solver.Solve(lpModel);

    if (!solution || !solution.feasible) {
      console.warn("⚠️ LP Solver infeasible, menggunakan formulasi aproksimasi fallback...");
      return this.calculateApproximationFallback(inputData);
    }

    const xi_star = Math.max(0, parseFloat(solution.result || solution.xi || 0));

    // --- STEP 6: NORMALIZE OPTIMAL WEIGHTS ---
    const rawWeights = {};
    let sumRaw = 0;

    criteria_list.forEach((c) => {
      const val = Math.max(0, parseFloat(solution[c.id] || 0));
      rawWeights[c.id] = val;
      sumRaw += val;
    });

    const normalizedWeights = {};
    criteria_list.forEach((c) => {
      normalizedWeights[c.id] = sumRaw > 0 ? rawWeights[c.id] / sumRaw : 1 / n;
    });

    // --- STEP 7: CONSISTENCY TEST (CR = xi* / CI) ---
    const a_BW = a_B[worst_criteria_id] || 1;
    const ci = REZAEI_CI_TABLE[Math.round(a_BW)] ?? 0.00;
    
    let consistencyRatio = 0;
    if (a_BW === 1 || ci === 0) {
      consistencyRatio = 0.00;
    } else {
      consistencyRatio = xi_star / ci;
    }

    const isConsistent = consistencyRatio <= 0.10;

    // --- STEP 8: PRINT TERMINAL RESULTS ---
    console.log("\n================================================================================");
    console.log("📊 HASIL KOMPUTASI BOBOT OPTIMAL KRITERIA (W*):");
    console.log("================================================================================");
    
    criteria_list.forEach((c) => {
      const wPct = (normalizedWeights[c.id] * 100).toFixed(2);
      console.log(`   • [${c.code || c.name}] ${c.name.padEnd(35)} = ${normalizedWeights[c.id].toFixed(4)} (${wPct}%)`);
    });

    console.log("--------------------------------------------------------------------------------");
    console.log(`📐 Nilai Deviasi Optimal (ξ*)  : ${xi_star.toFixed(4)}`);
    console.log(`📐 Consistency Index (CI/ξ_max): ${ci.toFixed(2)} (Berdasarkan a_BW = ${a_BW})`);
    console.log(`📐 Consistency Ratio (CR)     : ${consistencyRatio.toFixed(4)}`);
    
    if (isConsistent) {
      console.log(`✅ STATUS KONSISTENSI         : KONSISTEN (CR <= 0.10) 👍`);
    } else {
      console.log(`⚠️ STATUS KONSISTENSI         : TIDAK KONSISTEN (CR > 0.10) ❌`);
      console.log(`👉 Saran: Disarankan meninjau ulang preferensi A_B atau A_W di UI.`);
    }
    console.log("================================================================================");

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
  calculateApproximationFallback(inputData) {
    const { best_criteria_id, worst_criteria_id, best_to_others = {}, worst_to_others = {}, criteria_list } = inputData;
    const n = criteria_list.length;

    const weights = {};
    let sumW = 0;

    criteria_list.forEach((c) => {
      const a_Bj = parseFloat(best_to_others[c.id]) || 1;
      const a_jW = parseFloat(worst_to_others[c.id]) || 1;
      const w_j = 0.5 * (1 / a_Bj + a_jW / (parseFloat(best_to_others[worst_criteria_id]) || 1));
      weights[c.id] = w_j;
      sumW += w_j;
    });

    criteria_list.forEach((c) => {
      weights[c.id] = sumW > 0 ? weights[c.id] / sumW : 1 / n;
    });

    return {
      best_criteria_id,
      worst_criteria_id,
      weights,
      xi_star: 0,
      ci: 0,
      consistency_ratio: 0,
      is_consistent: true,
      mode: "APPROXIMATION_FALLBACK",
    };
  }
}

export const bwmWeightService = BwmWeightService.getInstance();

