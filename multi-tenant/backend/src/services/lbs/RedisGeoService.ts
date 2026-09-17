/*
 * RedisGeoService.ts
 * Multi-Tenant Singleton Service for Redis Geospatial Indexing & Spatial Presence
 * MOVA Architecture Stage 5 (Live LBS & Presence)
 */

import { redisClient } from "../../config/redis.js";

export interface RiderLocationPayload {
  tenantId: string;
  riderId: string;
  riderName?: string;
  lat: number;
  lon: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  capturedAt?: string;
  zoneId?: string | null;
  isInsideGeofence?: boolean;
}

export class RedisGeoService {
  private static instance: RedisGeoService | null = null;

  public static getInstance(): RedisGeoService {
    if (!RedisGeoService.instance) {
      RedisGeoService.instance = new RedisGeoService();
    }
    return RedisGeoService.instance;
  }

  private getGeoKey(tenantId: string): string {
    return `tenant:${tenantId}:riders_geo`;
  }

  private getMetaKey(tenantId: string, riderId: string): string {
    return `tenant:${tenantId}:rider_meta:${riderId}`;
  }

  private getLastPosKey(tenantId: string, riderId: string): string {
    return `tenant:${tenantId}:last_pos:${riderId}`;
  }

  private getThrottleKey(tenantId: string, riderId: string): string {
    return `tenant:${tenantId}:rider_throttle:${riderId}`;
  }

  private getSeqKey(tenantId: string, riderId: string, deviceId: string): string {
    return `tenant:${tenantId}:rider_seq:${riderId}:${deviceId}`;
  }

  /**
   * Check and update rate throttle (minimum 5-second interval)
   */
  public async checkAndSetThrottle(tenantId: string, riderId: string, intervalSeconds: number = 5): Promise<boolean> {
    const key = this.getThrottleKey(tenantId, riderId);
    try {
      if (typeof (redisClient as any).set === "function") {
        const result = await (redisClient as any).set(key, "1", { NX: true, EX: intervalSeconds });
        return result !== null;
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Check monotonic sequence to prevent GPS replay attacks
   */
  public async validateAndSetSequence(tenantId: string, riderId: string, deviceId: string, sequence: number): Promise<boolean> {
    const key = this.getSeqKey(tenantId, riderId, deviceId);
    try {
      let lastSeqStr: string | null = null;
      if (typeof (redisClient as any).get === "function") {
        lastSeqStr = await (redisClient as any).get(key);
      }
      if (lastSeqStr !== null) {
        const lastSeq = parseInt(lastSeqStr, 10);
        if (sequence <= lastSeq) {
          return false; // Replay or out-of-order sequence detected
        }
      }
      if (typeof (redisClient as any).set === "function") {
        await (redisClient as any).set(key, String(sequence), { EX: 86400 });
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Retrieve last accepted coordinate for distance filtering
   */
  public async getLastPosition(tenantId: string, riderId: string): Promise<{ latitude: number; longitude: number; captured_at?: string } | null> {
    const key = this.getLastPosKey(tenantId, riderId);
    try {
      let data: any = null;
      if (typeof (redisClient as any).hGetAll === "function") {
        data = await (redisClient as any).hGetAll(key);
      } else if (typeof (redisClient as any).hgetall === "function") {
        data = await (redisClient as any).hgetall(key);
      }
      if (data && data.latitude && data.longitude) {
        return {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          captured_at: data.captured_at,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Save last accepted coordinate
   */
  public async setLastPosition(tenantId: string, riderId: string, lat: number, lon: number, capturedAt?: string): Promise<void> {
    const key = this.getLastPosKey(tenantId, riderId);
    try {
      const payload: Record<string, string> = {
        latitude: String(lat),
        longitude: String(lon),
        captured_at: capturedAt || new Date().toISOString(),
      };
      if (typeof (redisClient as any).hSet === "function") {
        await (redisClient as any).hSet(key, payload);
      } else if (typeof (redisClient as any).hset === "function") {
        await (redisClient as any).hset(key, payload);
      }
      if (typeof (redisClient as any).expire === "function") {
        await (redisClient as any).expire(key, 86400);
      }
    } catch {}
  }

  /**
   * Update or Add Rider Location into Tenant-Scoped Redis Geospatial Index
   */
  public async updateRiderLocation(payload: RiderLocationPayload): Promise<any> {
    const { tenantId, riderId, riderName, lat, lon, speed = 0, heading = 0, zoneId, isInsideGeofence = true } = payload;
    if (!tenantId || !riderId || lat === undefined || lon === undefined) {
      throw new Error("tenantId, riderId, lat, dan lon harus diisi.");
    }

    const geoKey = this.getGeoKey(tenantId);
    const metaKey = this.getMetaKey(tenantId, riderId);

    try {
      if (typeof (redisClient as any).geoAdd === "function") {
        await (redisClient as any).geoAdd(geoKey, { longitude: lon, latitude: lat, member: riderId });
      } else if (typeof (redisClient as any).geoadd === "function") {
        await (redisClient as any).geoadd(geoKey, lon, lat, riderId);
      }

      const metaPayload: Record<string, string> = {
        tenant_id: tenantId,
        rider_id: riderId,
        rider_name: riderName || "Rider Operasional",
        latitude: String(lat),
        longitude: String(lon),
        speed: String(speed),
        heading: String(heading),
        zone_id: zoneId || "",
        is_inside_geofence: isInsideGeofence ? "true" : "false",
        updated_at: new Date().toISOString(),
      };

      if (typeof (redisClient as any).hSet === "function") {
        await (redisClient as any).hSet(metaKey, metaPayload);
      } else if (typeof (redisClient as any).hset === "function") {
        await (redisClient as any).hset(metaKey, metaPayload);
      }

      if (typeof (redisClient as any).expire === "function") {
        await (redisClient as any).expire(metaKey, 86400);
      }

      return {
        tenant_id: tenantId,
        rider_id: riderId,
        latitude: lat,
        longitude: lon,
        speed,
        heading,
        zone_id: zoneId || null,
        is_inside_geofence: isInsideGeofence,
      };
    } catch (err: any) {
      console.warn(`⚠️ [RedisGeoService] Error updating location for rider '${riderId}' in tenant '${tenantId}':`, err.message);
      return { tenant_id: tenantId, rider_id: riderId, latitude: lat, longitude: lon, degraded: true };
    }
  }

  /**
   * Fetch Nearby Active Riders within Tenant and Radius
   */
  public async getNearbyRiders({
    tenantId,
    lon,
    lat,
    radiusKm = 5,
    limit = 50,
  }: {
    tenantId: string;
    lon: number;
    lat: number;
    radiusKm?: number;
    limit?: number;
  }): Promise<any> {
    const geoKey = this.getGeoKey(tenantId);
    const radius = radiusKm;

    try {
      let rawResults: any[] = [];
      let searchSuccess = false;

      if (typeof (redisClient as any).geoSearch === "function") {
        try {
          const res = await (redisClient as any).geoSearch(
            geoKey,
            { longitude: lon, latitude: lat },
            { radius, unit: "km" },
            { WITHDIST: true, WITHCOORD: true, COUNT: limit }
          );

          if (Array.isArray(res)) {
            rawResults = res.map((r) => {
              if (typeof r === "string") return [r, "0", ["0", "0"]];
              const memberStr = typeof r.member === "string" ? r.member : String(r.member);
              const distStr = r.distance !== undefined ? String(r.distance) : "0";
              const coords = r.coordinates ? [String(r.coordinates.longitude), String(r.coordinates.latitude)] : ["0", "0"];
              return [memberStr, distStr, coords];
            });
            searchSuccess = true;
          }
        } catch {
          if (typeof (redisClient as any).geoRadius === "function") {
            try {
              const res = await (redisClient as any).geoRadius(geoKey, { longitude: lon, latitude: lat }, radius, "km", {
                WITHDIST: true,
                WITHCOORD: true,
                COUNT: limit,
              });
              if (Array.isArray(res)) {
                rawResults = res.map((r) => {
                  if (typeof r === "string") return [r, "0", ["0", "0"]];
                  const memberStr = typeof r.member === "string" ? r.member : String(r.member);
                  const distStr = r.distance !== undefined ? String(r.distance) : "0";
                  const coords = r.coordinates ? [String(r.coordinates.longitude), String(r.coordinates.latitude)] : ["0", "0"];
                  return [memberStr, distStr, coords];
                });
                searchSuccess = true;
              }
            } catch {}
          }
        }
      }

      if (!rawResults || rawResults.length === 0) {
        return {
          query_center: { latitude: lat, longitude: lon },
          radius_km: radius,
          total_riders_found: 0,
          riders: [],
        };
      }

      const riders = await Promise.all(
        rawResults.map(async (item) => {
          const [riderId, distStr, coords] = item;
          const metaKey = this.getMetaKey(tenantId, riderId);
          let meta: any = null;
          try {
            if (typeof (redisClient as any).hGetAll === "function") {
              meta = await (redisClient as any).hGetAll(metaKey);
            } else if (typeof (redisClient as any).hgetall === "function") {
              meta = await (redisClient as any).hgetall(metaKey);
            }
          } catch {}

          return {
            rider_id: riderId,
            rider_name: meta?.rider_name || "Rider Operasional",
            distance_km: parseFloat(distStr),
            distance_meters: Math.round(parseFloat(distStr) * 1000),
            location: {
              latitude: parseFloat(coords[1]),
              longitude: parseFloat(coords[0]),
            },
            telemetry: {
              speed: parseFloat(meta?.speed || 0),
              heading: parseFloat(meta?.heading || 0),
              zone_id: meta?.zone_id || null,
              is_inside_geofence: meta?.is_inside_geofence === "true",
              updated_at: meta?.updated_at || null,
            },
          };
        })
      );

      return {
        query_center: { latitude: lat, longitude: lon },
        radius_km: radius,
        total_riders_found: riders.length,
        riders,
      };
    } catch (err: any) {
      return {
        query_center: { latitude: lat, longitude: lon },
        radius_km: radius,
        total_riders_found: 0,
        riders: [],
        degraded: true,
      };
    }
  }

  /**
   * Get Single Rider Live Position & Telemetry Metadata
   */
  public async getRiderLocation(tenantId: string, riderId: string): Promise<any | null> {
    const geoKey = this.getGeoKey(tenantId);
    const metaKey = this.getMetaKey(tenantId, riderId);

    try {
      let pos: any = null;
      if (typeof (redisClient as any).geoPos === "function") {
        pos = await (redisClient as any).geoPos(geoKey, riderId);
      } else if (typeof (redisClient as any).geopos === "function") {
        pos = await (redisClient as any).geopos(geoKey, riderId);
      }

      if (!pos || !pos[0]) {
        return null;
      }

      const coords = pos[0].longitude !== undefined ? [pos[0].longitude, pos[0].latitude] : pos[0];
      let meta: any = null;
      try {
        if (typeof (redisClient as any).hGetAll === "function") {
          meta = await (redisClient as any).hGetAll(metaKey);
        } else if (typeof (redisClient as any).hgetall === "function") {
          meta = await (redisClient as any).hgetall(metaKey);
        }
      } catch {}

      return {
        tenant_id: tenantId,
        rider_id: riderId,
        rider_name: meta?.rider_name || "Rider Operasional",
        location: {
          latitude: parseFloat(coords[1]),
          longitude: parseFloat(coords[0]),
        },
        telemetry: {
          speed: parseFloat(meta?.speed || 0),
          heading: parseFloat(meta?.heading || 0),
          zone_id: meta?.zone_id || null,
          is_inside_geofence: meta?.is_inside_geofence === "true",
          updated_at: meta?.updated_at || null,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Remove Rider Location from Redis
   */
  public async removeRiderLocation(tenantId: string, riderId: string): Promise<boolean> {
    const geoKey = this.getGeoKey(tenantId);
    const metaKey = this.getMetaKey(tenantId, riderId);
    const lastPosKey = this.getLastPosKey(tenantId, riderId);
    try {
      if (typeof (redisClient as any).zRem === "function") {
        await (redisClient as any).zRem(geoKey, riderId);
      } else if (typeof (redisClient as any).zrem === "function") {
        await (redisClient as any).zrem(geoKey, riderId);
      }
      if (typeof (redisClient as any).del === "function") {
        await (redisClient as any).del(metaKey);
        await (redisClient as any).del(lastPosKey);
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const redisGeoService = RedisGeoService.getInstance();
