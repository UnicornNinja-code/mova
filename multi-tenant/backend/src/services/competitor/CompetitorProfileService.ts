/*
 * CompetitorProfileService.ts
 * Tenant-Scoped Competitor Profile Management Service
 */

import { withTenantContext } from "../../lib/tenantContext.js";

export interface CompetitorProfileDTO {
  id?: string;
  name: string;
  min_price: number;
  max_price: number;
  radius_meters: number;
  target_categories: string[];
  business_models: string[];
  activity_start?: string;
  activity_end?: string;
  is_active?: boolean;
}

export class CompetitorProfileService {
  private static instance: CompetitorProfileService | null = null;

  public static getInstance(): CompetitorProfileService {
    if (!CompetitorProfileService.instance) {
      CompetitorProfileService.instance = new CompetitorProfileService();
    }
    return CompetitorProfileService.instance;
  }

  /**
   * Mengambil profil kompetitor aktif milik tenant
   */
  public async getActiveProfile(tenantId: string): Promise<CompetitorProfileDTO> {
    return withTenantContext(tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, name, min_price, max_price, radius_meters, 
                target_categories, business_models, activity_start, activity_end, is_active
         FROM competitor_profiles
         WHERE is_active = true
         ORDER BY created_at ASC
         LIMIT 1;`
      );

      if (rows.length > 0) {
        return rows[0];
      }

      // Buat profil default jika belum ada
      const defaultInsert = await client.query(
        `INSERT INTO competitor_profiles (
          tenant_id, name, min_price, max_price, radius_meters,
          target_categories, business_models, activity_start, activity_end, is_active
        ) VALUES (
          $1, 'Default Mobile Coffee Competitor Profile', 8000, 18000, 500,
          $2, $3, '06:00:00', '22:00:00', true
        ) RETURNING id, name, min_price, max_price, radius_meters, 
                    target_categories, business_models, activity_start, activity_end, is_active;`,
        [
          tenantId,
          ["WARUNG_KOPI", "GIRAS", "KOPI_KELILING", "BOOTH"],
          ["MOBILE", "SEMI_MOBILE", "BOOTH"],
        ]
      );

      return defaultInsert.rows[0];
    });
  }

  /**
   * Membuat profil kompetitor baru
   */
  public async createProfile(tenantId: string, data: CompetitorProfileDTO): Promise<CompetitorProfileDTO> {
    if (data.min_price > data.max_price) {
      throw new Error("INVALID_PRICE: min_price tidak boleh lebih besar dari max_price.");
    }
    if (data.radius_meters <= 0) {
      throw new Error("INVALID_RADIUS: radius_meters harus bernilai positif.");
    }

    return withTenantContext(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO competitor_profiles (
          tenant_id, name, min_price, max_price, radius_meters,
          target_categories, business_models, activity_start, activity_end, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING id, name, min_price, max_price, radius_meters, 
                    target_categories, business_models, activity_start, activity_end, is_active;`,
        [
          tenantId,
          data.name,
          data.min_price,
          data.max_price,
          data.radius_meters,
          data.target_categories,
          data.business_models,
          data.activity_start || "06:00:00",
          data.activity_end || "22:00:00",
          data.is_active ?? true,
        ]
      );

      return rows[0];
    });
  }

  /**
   * Mengupdate profil kompetitor
   */
  public async updateProfile(
    tenantId: string,
    profileId: string,
    data: Partial<CompetitorProfileDTO>
  ): Promise<CompetitorProfileDTO> {
    return withTenantContext(tenantId, async (client) => {
      const existing = await client.query(
        `SELECT id, min_price, max_price FROM competitor_profiles WHERE id = $1;`,
        [profileId]
      );

      if (existing.rows.length === 0) {
        throw new Error(`PROFIL_NOT_FOUND: Profil kompetitor '${profileId}' tidak ditemukan untuk tenant ini.`);
      }

      const minPrice = data.min_price ?? existing.rows[0].min_price;
      const maxPrice = data.max_price ?? existing.rows[0].max_price;

      if (minPrice > maxPrice) {
        throw new Error("INVALID_PRICE: min_price tidak boleh lebih besar dari max_price.");
      }

      const { rows } = await client.query(
        `UPDATE competitor_profiles
         SET name = COALESCE($2, name),
             min_price = COALESCE($3, min_price),
             max_price = COALESCE($4, max_price),
             radius_meters = COALESCE($5, radius_meters),
             target_categories = COALESCE($6, target_categories),
             business_models = COALESCE($7, business_models),
             activity_start = COALESCE($8, activity_start),
             activity_end = COALESCE($9, activity_end),
             is_active = COALESCE($10, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, name, min_price, max_price, radius_meters, 
                   target_categories, business_models, activity_start, activity_end, is_active;`,
        [
          profileId,
          data.name,
          data.min_price,
          data.max_price,
          data.radius_meters,
          data.target_categories,
          data.business_models,
          data.activity_start,
          data.activity_end,
          data.is_active,
        ]
      );

      return rows[0];
    });
  }
}

export const competitorProfileService = CompetitorProfileService.getInstance();
