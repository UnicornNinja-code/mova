/*
 * CriteriaMasterService.ts
 * Master Configuration Service for the 6 MOVA DSS Decision Criteria (C1-C6)
 * 
 * Standar Kriteria:
 * - C1: Densitas POI (BENEFIT)
 * - C2: Diversitas POI (BENEFIT)
 * - C3: Potensi Keramaian Waktu (BENEFIT)
 * - C4: Risiko Cuaca (COST)
 * - C5: Jarak Aksesibilitas Rider (COST)
 * - C6: Dampak Kompetitor Relevan (COST)
 */

import { pool } from "../../config/database.js";
import type { CriterionDefinition } from "./SafeTopsisEngine.js";

export interface StandardCriterion {
  code: string;
  name: string;
  type: "BENEFIT" | "COST";
  unit: string;
  description: string;
  default_weight: number;
}

export const STANDARD_DSS_CRITERIA: StandardCriterion[] = [
  {
    code: "C1",
    name: "Densitas POI",
    type: "BENEFIT",
    unit: "POI",
    description: "Kepadatan POI target yang relevan dalam poligon zona atau radius kandidat",
    default_weight: 0.32,
  },
  {
    code: "C2",
    name: "Diversitas POI",
    type: "BENEFIT",
    unit: "CATEGORY",
    description: "Keanekaragaman kategori POI komersial, publik, dan transportasi",
    default_weight: 0.24,
  },
  {
    code: "C3",
    name: "Potensi Keramaian Waktu",
    type: "BENEFIT",
    unit: "SCORE",
    description: "Skor keramaian dinamis berbasis matriks time-slot (pagi, siang, sore, malam)",
    default_weight: 0.20,
  },
  {
    code: "C4",
    name: "Risiko Cuaca",
    type: "COST",
    unit: "PERCENT",
    description: "Probabilitas hujan dan intensitas presipitasi cuaca buruk dari Open-Meteo",
    default_weight: 0.12,
  },
  {
    code: "C5",
    name: "Jarak Aksesibilitas Rider",
    type: "COST",
    unit: "KM",
    description: "Jarak tempuh armada keliling dari hub operasional menuju lokasi kandidat",
    default_weight: 0.08,
  },
  {
    code: "C6",
    name: "Dampak Kompetitor Relevan",
    type: "COST",
    unit: "INDEX",
    description: "Tekanan kompetitif terbobot dari kompetitor dengan kesesuaian harga, kategori, dan model operasi",
    default_weight: 0.04,
  },
];

export class CriteriaMasterService {
  private static instance: CriteriaMasterService | null = null;

  public static getInstance(): CriteriaMasterService {
    if (!CriteriaMasterService.instance) {
      CriteriaMasterService.instance = new CriteriaMasterService();
    }
    return CriteriaMasterService.instance;
  }

  /**
   * Memastikan master kriteria terdaftar secara konsisten di database
   */
  public async ensureStandardCriteriaInDb(): Promise<void> {
    for (const c of STANDARD_DSS_CRITERIA) {
      const fullName = `${c.code} - ${c.name}`;
      await pool.query(
        `INSERT INTO criterias (name, type, is_active, weight)
         VALUES ($1, $2::"CriteriaType", true, $3)
         ON CONFLICT (name) DO UPDATE SET
           type = EXCLUDED.type,
           weight = EXCLUDED.weight,
           is_active = true;`,
        [fullName, c.type, c.default_weight]
      );
    }
  }

  /**
   * Mengambil spesifikasi kriteria dengan bobot aktif (baik dari BWM atau default)
   */
  public getCriteriaDefinitions(weights?: Record<string, number>): CriterionDefinition[] {
    return STANDARD_DSS_CRITERIA.map((c) => ({
      code: c.code,
      name: c.name,
      type: c.type,
      weight: weights && weights[c.code] !== undefined ? weights[c.code] : c.default_weight,
    }));
  }
}

export const criteriaMasterService = CriteriaMasterService.getInstance();
