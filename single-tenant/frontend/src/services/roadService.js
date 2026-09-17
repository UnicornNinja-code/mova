import { axiosInstance } from "../lib/axios.js";

export const roadService = {
  /**
   * Fetch GeoJSON FeatureCollection of Protocol Roads (Spatial Restriction Layer)
   */
  getProtocolRoads: async () => {
    const res = await axiosInstance.get("/roads/protocol");
    return res.data;
  },

  /**
   * Fetch GeoJSON FeatureCollection of Toll Roads (Spatial Restriction Layer)
   */
  getTollRoads: async () => {
    const res = await axiosInstance.get("/roads/toll");
    return res.data;
  },

  /**
   * Fetch zone road accessibility score (C4 criterion)
   */
  getZoneAccessibilityScore: async (zone_id) => {
    const res = await axiosInstance.get(`/roads/zone-accessibility-score/${zone_id}`);
    return res.data;
  },

  /**
   * Trigger Toll Roads synchronization from Overpass API
   */
  syncTollRoads: async () => {
    const res = await axiosInstance.post("/roads/sync-toll");
    return res.data;
  },
};
