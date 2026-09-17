/*
 * poiModel.ts
 * Backward-Compatible Wrapper over POIRepository in TypeScript
 */

import { poiRepository } from "../repositories/poiRepository.js";

export const PoiModel = {
  findAll: () => poiRepository.findAll(),
  findByZonePolygon: (zonePolygon: any) => poiRepository.findByZonePolygon(zonePolygon),
  syncCityPoisWithTransaction: (poisData: any[]) => poiRepository.syncCityPoisWithTransaction(poisData),
  getDensitasDanDiversitasByZonePolygon: (zonePolygon: any) => poiRepository.getDensitasDanDiversitasByZonePolygon(zonePolygon),
  reclusterExistingPoisWithTransaction: (updates: any[], deleteIds: any[]) => poiRepository.reclusterExistingPoisWithTransaction(updates, deleteIds),
  getLeakageReport: (limit?: number) => poiRepository.getLeakageReport(limit),
};
