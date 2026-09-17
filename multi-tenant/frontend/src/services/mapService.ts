/*
 * mapService.ts
 * Spatial & LBS Tracking REST Service for Leaflet Map
 */

import { axiosInstance } from "../lib/axios";

export interface ZoneFeature {
  id: string;
  name: string;
  code?: string;
  description?: string;
  max_capacity: number;
  status: "ACTIVE" | "INACTIVE" | "RESTRICTED";
  polygon?: any;
  coordinates?: [number, number][];
  current_riders?: number;
}

export interface NearbyRider {
  riderId: string;
  name: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  battery?: number;
  distanceMeters?: number;
  zoneId?: string;
  zoneName?: string;
  plateNumber?: string;
  vehicleType?: string;
  status?: "CHECKED_IN" | "OTW" | "IDLE" | "BREACH";
  updatedAt?: string;
}

export interface POIFeature {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  operational_status?: string;
  approval_status?: string;
}

export interface HubWeatherOverview {
  status: string;
  hub_city_name: string;
  total_zones: number;
  hub_overview: {
    avg_temperature_c: number;
    max_rain_probability_percent: number;
    weather_condition: string;
    weather_code: number;
    active_time_slot: string;
    operational_hours: string;
  };
  zones_weather_list: Array<{
    zone_id: string;
    zone_name: string;
    skor_c4_cost: number;
    rain_probability_percent: number;
    temperature_c: number;
    weather_code: number;
    weather_condition: string;
    risk_level: "HIGH" | "MEDIUM" | "LOW";
  }>;
}

export interface GeocodeResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: any;
  city?: string;
}

export const mapService = {
  getZoneConfig: async (): Promise<any> => {
    const res = await axiosInstance.get("/zones/config");
    return res.data;
  },

  getAllZones: async (): Promise<ZoneFeature[]> => {
    const res = await axiosInstance.get("/zones");
    return res.data?.zones || res.data || [];
  },

  getProtocolRoads: async (): Promise<any> => {
    const res = await axiosInstance.get("/roads/protocol");
    return res.data?.geojson || res.data;
  },

  getTollRoads: async (): Promise<any> => {
    const res = await axiosInstance.get("/roads/toll");
    return res.data?.geojson || res.data;
  },

  getNearbyRiders: async (
    lat: number = -7.2575,
    lng: number = 112.7521,
    radiusMeters: number = 50000
  ): Promise<NearbyRider[]> => {
    try {
      const res = await axiosInstance.get("/lbs/nearby", {
        params: { lat, lng, lon: lng, radius: radiusMeters, radiusKm: radiusMeters / 1000 },
      });
      return res.data?.riders || res.data || [];
    } catch {
      return [];
    }
  },

  getPOIs: async (params?: { category?: string; search?: string; limit?: number; zone_id?: string } | string): Promise<POIFeature[]> => {
    try {
      const queryParams = typeof params === 'string' ? { category: params } : params;
      const res = await axiosInstance.get("/pois", { params: queryParams });
      return res.data?.pois || res.data?.data || (Array.isArray(res.data) ? res.data : []);
    } catch {
      return [];
    }
  },

  getHubWeather: async (_cityName?: string): Promise<HubWeatherOverview | null> => {
    try {
      const res = await axiosInstance.get("/weathers/hub");
      return res.data;
    } catch {
      return null;
    }
  },

  getHubAtmosphericOverview: async (): Promise<HubWeatherOverview | null> => {
    try {
      const res = await axiosInstance.get("/weathers/overview");
      return res.data;
    } catch {
      return null;
    }
  },

  getZoneWeather: async (zoneId: string): Promise<any> => {
    try {
      const res = await axiosInstance.get(`/weathers/zone/${zoneId}`);
      return res.data;
    } catch {
      return null;
    }
  },

  syncWeather: async (): Promise<any> => {
    const res = await axiosInstance.post("/weathers/sync");
    return res.data;
  },

  /**
   * Search location strictly restricted to Indonesia via OpenStreetMap Nominatim
   */
  searchLocation: async (query: string): Promise<GeocodeResult[]> => {
    if (!query || query.trim().length < 2) return [];
    try {
      const nominatimBase = (import.meta.env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
      const cleanQuery = encodeURIComponent(query.trim());
      const res = await fetch(
        `${nominatimBase}/search?format=json&q=${cleanQuery}&countrycodes=id&viewbox=95.0,-11.0,141.0,6.0&bounded=1&limit=6&addressdetails=1`
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: any) => {
        const addr = item.address || {};
        const rawCity = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || addr.state_district || '';
        const cleanCity = rawCity.replace(/^(Kota|Kabupaten|Kab\.|Kota Administrasi)\s+/i, '').trim();

        return {
          ...item,
          city: cleanCity || undefined,
        };
      });
    } catch (err) {
      console.warn('[mapService] Gagal melakukan pencarian lokasi:', err);
      return [];
    }
  },

  /**
   * Reverse geocode coordinates to structured address via OpenStreetMap Nominatim
   */
  reverseGeocode: async (lat: number, lon: number): Promise<{ displayName: string; city?: string; addressDetails?: any } | null> => {
    try {
      const nominatimBase = (import.meta.env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
      const res = await fetch(
        `${nominatimBase}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.display_name) return null;

      const addr = data.address || {};
      const city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || addr.state_district || '';
      const cleanCity = city.replace(/^(Kota|Kabupaten|Kab\.|Kota Administrasi)\s+/i, '').trim();

      return {
        displayName: data.display_name,
        city: cleanCity,
        addressDetails: addr,
      };
    } catch (err) {
      console.warn('[mapService] Gagal melakukan reverse geocode:', err);
      return null;
    }
  },

  // Backward compatibility alias
  searchSidoarjoLocation: async (query: string): Promise<GeocodeResult[]> => {
    return mapService.searchLocation(query);
  },
};
