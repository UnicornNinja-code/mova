/*
 * CompetitorObservationService.ts
 * Tenant-Scoped Dynamic Field Competitor Observation & Lifecycle Service
 */

import { withTenantContext } from "../../lib/tenantContext.js";

export interface CompetitorObservationDTO {
  id?: string;
  profile_id?: string | null;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  min_price?: number | null;
  max_price?: number | null;
  business_model?: string;
  source?: string;
  confidence?: number;
  status?: string;
  activity_start?: string | null;
  activity_end?: string | null;
  observed_at?: Date;
  expires_at?: Date;
}

export class CompetitorObservationService {
  private static instance: CompetitorObservationService | null = null;

  public static getInstance(): CompetitorObservationService {
    if (!CompetitorObservationService.instance) {
      CompetitorObservationService.instance = new CompetitorObservationService();
    }
    return CompetitorObservationService.instance;
  }

  /**
   * Melaporkan observasi kompetitor lapangan (Rider / Staff)
   * Status default = 'PENDING', Confidence default = 0.6, Expire = 24 jam
   */
  public async reportObservation(
    tenantId: string,
    userId: string | null,
    data: CompetitorObservationDTO
  ): Promise<CompetitorObservationDTO> {
    if (data.min_price != null && data.max_price != null && data.min_price > data.max_price) {
      throw new Error("INVALID_PRICE: min_price tidak boleh lebih besar dari max_price.");
    }
    if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) {
      throw new Error("INVALID_COORDINATES: Koordinat lintang atau bujur di luar jangkauan geografis bumi.");
    }

    return withTenantContext(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO competitor_observations (
          tenant_id, profile_id, name, category, latitude, longitude,
          min_price, max_price, business_model, source, confidence, status,
          activity_start, activity_end, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, COALESCE($9, 'MOBILE'), COALESCE($10, 'RIDER'), 0.6, 'PENDING',
          $11, $12, $13
        ) RETURNING id, profile_id, name, category, latitude, longitude,
                    min_price, max_price, business_model, source, confidence, status,
                    activity_start, activity_end, observed_at, expires_at;`,
        [
          tenantId,
          data.profile_id || null,
          data.name,
          data.category,
          data.latitude,
          data.longitude,
          data.min_price || null,
          data.max_price || null,
          data.business_model || "MOBILE",
          data.source || "RIDER",
          data.activity_start || null,
          data.activity_end || null,
          userId,
        ]
      );

      return rows[0];
    });
  }

  /**
   * Memverifikasi observasi kompetitor oleh Supervisor / Management
   * Mengubah status menjadi 'VERIFIED', meningkatkan confidence = 1.0, dan memperpanjang masa berlaku
   */
  public async verifyObservation(
    tenantId: string,
    observationId: string,
    extendHours: number = 48
  ): Promise<CompetitorObservationDTO> {
    return withTenantContext(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE competitor_observations
         SET status = 'VERIFIED',
             confidence = 1.0,
             expires_at = CURRENT_TIMESTAMP + ($2 || ' hours')::interval,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, profile_id, name, category, latitude, longitude,
                   min_price, max_price, business_model, source, confidence, status,
                   activity_start, activity_end, observed_at, expires_at;`,
        [observationId, extendHours]
      );

      if (rows.length === 0) {
        throw new Error(`OBSERVATION_NOT_FOUND: Observasi '${observationId}' tidak ditemukan untuk tenant ini.`);
      }

      return rows[0];
    });
  }

  /**
   * Menolak observasi kompetitor yang tidak valid/spam
   */
  public async rejectObservation(tenantId: string, observationId: string): Promise<CompetitorObservationDTO> {
    return withTenantContext(tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE competitor_observations
         SET status = 'REJECTED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, status;`,
        [observationId]
      );

      if (rows.length === 0) {
        throw new Error(`OBSERVATION_NOT_FOUND: Observasi '${observationId}' tidak ditemukan untuk tenant ini.`);
      }

      return rows[0];
    });
  }

  /**
   * Mengambil seluruh observasi aktif (PENDING & VERIFIED, belum expired) dalam radius geografis tertentu
   */
  public async getActiveObservationsInRadius(
    tenantId: string,
    lat: number,
    lon: number,
    radiusMeters: number
  ): Promise<any[]> {
    return withTenantContext(tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT 
          id, profile_id, name, category, latitude, longitude,
          min_price, max_price, business_model, source, confidence, status,
          activity_start, activity_end, observed_at, expires_at,
          ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance_meters
        FROM competitor_observations
        WHERE status IN ('PENDING', 'VERIFIED')
          AND expires_at > CURRENT_TIMESTAMP
          AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
        ORDER BY distance_meters ASC;`,
        [lat, lon, radiusMeters]
      );

      return rows;
    });
  }
}

export const competitorObservationService = CompetitorObservationService.getInstance();
