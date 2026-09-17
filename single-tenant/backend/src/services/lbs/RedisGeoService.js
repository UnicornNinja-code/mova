/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   RedisGeoService.js (Clean Architecture Singleton Service for Redis Geospatial Indexing)
 *   Supports node-redis v4 & ioredis methods (GEOADD, GEOSEARCH, GEODIST).
 */

import { redisClient } from "../../config/redis.js";

export class RedisGeoService {
  static instance = null;

  constructor() {
    if (RedisGeoService.instance) {
      return RedisGeoService.instance;
    }
    this.geoKey = "RIDERS_GEO_INDEX";
    RedisGeoService.instance = this;
  }

  static getInstance() {
    if (!RedisGeoService.instance) {
      RedisGeoService.instance = new RedisGeoService();
    }
    return RedisGeoService.instance;
  }

  /**
   * Update or Add Rider Location into Redis Geospatial Index Set
   */
  async updateRiderLocation({ riderId, riderName, lat, lon, speed = 0, heading = 0 }) {
    if (!riderId || lat === undefined || lon === undefined) {
      throw new Error("riderId, lat, dan lon harus diisi.");
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    try {
      // 1. GEOADD
      if (typeof redisClient.geoAdd === "function") {
        await redisClient.geoAdd(this.geoKey, { longitude, latitude, member: riderId });
      } else if (typeof redisClient.geoadd === "function") {
        await redisClient.geoadd(this.geoKey, longitude, latitude, riderId);
      }

      // 2. Telemetry Hash Metadata (24h TTL)
      const metaKey = `RIDER_META:${riderId}`;
      const payload = {
        rider_id: String(riderId),
        rider_name: String(riderName || "Rider Operasional"),
        latitude: String(latitude),
        longitude: String(longitude),
        speed: String(parseFloat(speed)),
        heading: String(parseFloat(heading)),
        updated_at: new Date().toISOString(),
      };

      if (typeof redisClient.hSet === "function") {
        await redisClient.hSet(metaKey, payload);
      } else if (typeof redisClient.hset === "function") {
        await redisClient.hset(metaKey, payload);
      }

      await redisClient.expire(metaKey, 86400);
      return { riderId, latitude, longitude, speed, heading };
    } catch (err) {
      console.warn(`⚠️ [RedisGeoService] Error updating location for rider '${riderId}':`, err.message);
      return { riderId, latitude, longitude, speed, heading, degraded: true };
    }
  }

  /**
   * Fetch Nearby Active Riders within Radius X km (Sub-Millisecond Execution)
   */
  async getNearbyRiders({ lon, lat, radiusKm = 5, limit = 50 }) {
    if (lat === undefined || lon === undefined) {
      throw new Error("Koordinat lon dan lat harus diisi.");
    }

    const longitude = parseFloat(lon);
    const latitude = parseFloat(lat);
    const radius = parseFloat(radiusKm);

    try {
      let rawResults = [];
      let searchSuccess = false;

      // Try node-redis v4 geoSearch
      if (typeof redisClient.geoSearch === "function") {
        try {
          const res = await redisClient.geoSearch(
            this.geoKey,
            { longitude, latitude },
            { radius, unit: "km" },
            { WITHDIST: true, WITHCOORD: true }
          );

          if (Array.isArray(res)) {
            rawResults = res.map((r) => {
              if (typeof r === "string") return [r, "0", ["0", "0"]];
              const memberStr = typeof r.member === "string" ? r.member : String(r.member);
              const distStr = r.distance !== undefined ? String(r.distance) : "0";
              const coords = r.coordinates
                ? [String(r.coordinates.longitude), String(r.coordinates.latitude)]
                : ["0", "0"];
              return [memberStr, distStr, coords];
            });
            searchSuccess = true;
          }
        } catch (e) {
          // Fallback to node-redis geoRadius
          if (typeof redisClient.geoRadius === "function") {
            try {
              const res = await redisClient.geoRadius(
                this.geoKey,
                { longitude, latitude },
                radius,
                "km",
                { WITHDIST: true, WITHCOORD: true }
              );

              if (Array.isArray(res)) {
                rawResults = res.map((r) => {
                  if (typeof r === "string") return [r, "0", ["0", "0"]];
                  const memberStr = typeof r.member === "string" ? r.member : String(r.member);
                  const distStr = r.distance !== undefined ? String(r.distance) : "0";
                  const coords = r.coordinates
                    ? [String(r.coordinates.longitude), String(r.coordinates.latitude)]
                    : ["0", "0"];
                  return [memberStr, distStr, coords];
                });
                searchSuccess = true;
              }
            } catch (err) {}
          }
          if (!searchSuccess) {
            throw e;
          }
        }
      }

      if (!rawResults || rawResults.length === 0) {
        return {
          query_center: { latitude, longitude },
          radius_km: radius,
          total_riders_found: 0,
          riders: [],
        };
      }

      // Merge metadata for each rider found
      const riders = await Promise.all(
        rawResults.map(async (item) => {
          const [riderId, distStr, coords] = item;
          const metaKey = `RIDER_META:${riderId}`;
          
          let meta = null;
          try {
            if (typeof redisClient.hGetAll === "function") {
              meta = await redisClient.hGetAll(metaKey);
            } else if (typeof redisClient.hgetall === "function") {
              meta = await redisClient.hgetall(metaKey);
            }
          } catch (mErr) {}

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
              updated_at: meta?.updated_at || null,
            },
          };
        })
      );

      return {
        query_center: { latitude, longitude },
        radius_km: radius,
        total_riders_found: riders.length,
        riders,
      };
    } catch (err) {
      console.warn("⚠️ [RedisGeoService] Error in getNearbyRiders:", err.message);
      return {
        query_center: { latitude, longitude },
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
  async getRiderLocation(riderId) {
    if (!riderId) throw new Error("riderId harus diisi.");

    try {
      let pos = null;
      if (typeof redisClient.geoPos === "function") {
        pos = await redisClient.geoPos(this.geoKey, riderId);
      } else if (typeof redisClient.geopos === "function") {
        pos = await redisClient.geopos(this.geoKey, riderId);
      }

      if (!pos || !pos[0]) {
        return null;
      }

      // pos format node-redis v4: [{ longitude, latitude }] or [[lon, lat]]
      const coords = pos[0].longitude !== undefined ? [pos[0].longitude, pos[0].latitude] : pos[0];

      const metaKey = `RIDER_META:${riderId}`;
      let meta = null;
      if (typeof redisClient.hGetAll === "function") {
        meta = await redisClient.hGetAll(metaKey);
      } else if (typeof redisClient.hgetall === "function") {
        meta = await redisClient.hgetall(metaKey);
      }

      return {
        rider_id: riderId,
        rider_name: meta?.rider_name || "Rider Operasional",
        location: {
          latitude: parseFloat(coords[1]),
          longitude: parseFloat(coords[0]),
        },
        telemetry: {
          speed: parseFloat(meta?.speed || 0),
          heading: parseFloat(meta?.heading || 0),
          updated_at: meta?.updated_at || null,
        },
      };
    } catch (err) {
      console.warn(`⚠️ [RedisGeoService] Error in getRiderLocation for '${riderId}':`, err.message);
      return null;
    }
  }

  /**
   * Calculate Exact Geodesic Distance Between Two Active Riders in Redis (GEODIST)
   */
  async calculateRiderDistance(riderId1, riderId2) {
    if (!riderId1 || !riderId2) {
      throw new Error("riderId1 dan riderId2 harus diisi.");
    }

    try {
      let distKmVal = null;
      if (typeof redisClient.geoDist === "function") {
        distKmVal = await redisClient.geoDist(this.geoKey, riderId1, riderId2, "km");
      } else if (typeof redisClient.geodist === "function") {
        distKmVal = await redisClient.geodist(this.geoKey, riderId1, riderId2, "km");
      }

      if (distKmVal === null || distKmVal === undefined) {
        return null;
      }

      const distKm = parseFloat(distKmVal);
      return {
        rider1_id: riderId1,
        rider2_id: riderId2,
        distance_km: distKm,
        distance_meters: Math.round(distKm * 1000),
      };
    } catch (err) {
      console.warn(`⚠️ [RedisGeoService] Error in calculateRiderDistance:`, err.message);
      return null;
    }
  }

  /**
   * Remove Rider Location from Redis Spatial Index Set
   */
  async removeRiderLocation(riderId) {
    if (!riderId) return false;
    try {
      if (typeof redisClient.zRem === "function") {
        await redisClient.zRem(this.geoKey, riderId);
      } else if (typeof redisClient.zrem === "function") {
        await redisClient.zrem(this.geoKey, riderId);
      }
      await redisClient.del(`RIDER_META:${riderId}`);
      return true;
    } catch (err) {
      console.warn(`⚠️ [RedisGeoService] Error removing rider '${riderId}':`, err.message);
      return false;
    }
  }
}

export const redisGeoService = RedisGeoService.getInstance();
