/*
 * test-bwm.js
 * Manual Test Script for BWM (Best-Worst Method) Weight Optimization Engine
 */

import { bwmWeightService } from "../services/dss/BwmWeightService.js";

async function testBwmEngine() {
  const sampleCriteriaList = [
    { id: "c1-id", code: "C1", name: "Densitas POI (Benefit)" },
    { id: "c2-id", code: "C2", name: "Diversitas POI (Benefit)" },
    { id: "c3-id", code: "C3", name: "Keramaian Berbasis Waktu (Benefit)" },
    { id: "c4-id", code: "C4", name: "Kondisi Cuaca (Cost)" },
    { id: "c5-id", code: "C5", name: "Jarak Hub/Rider (Cost)" },
    { id: "c6-id", code: "C6", name: "Dampak Kompetitor (Cost)" },
  ];

  const sampleBestToOthers = {
    "c1-id": 2, // C3 vs C1 = 2 (C3 2x lebih penting dari C1)
    "c2-id": 3, // C3 vs C2 = 3
    "c3-id": 1, // C3 vs C3 = 1 (Dirinya sendiri)
    "c4-id": 4, // C3 vs C4 = 4
    "c5-id": 7, // C3 vs C5 = 7 (C3 7x lebih penting dari C5 Worst)
    "c6-id": 3, // C3 vs C6 = 3
  };

  const sampleWorstToOthers = {
    "c1-id": 5, // C1 vs C5 = 5
    "c2-id": 4, // C2 vs C5 = 4
    "c3-id": 7, // C3 vs C5 = 7
    "c4-id": 2, // C4 vs C5 = 2
    "c5-id": 1, // C5 vs C5 = 1 (Dirinya sendiri)
    "c6-id": 4, // C6 vs C5 = 4
  };

  console.log("🧪 Memulai Pengujian Manual BWM Weight Engine...\n");

  const result = bwmWeightService.calculateBwmWeights({
    best_criteria_id: "c3-id",
    worst_criteria_id: "c5-id",
    best_to_others: sampleBestToOthers,
    worst_to_others: sampleWorstToOthers,
    criteria_list: sampleCriteriaList,
  });

  console.log("\n🎉 Pengujian Manual Selesai! Hasil perhitungan JSON:");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

testBwmEngine();
