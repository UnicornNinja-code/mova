/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   PoiModel (Backward-Compatible Wrapper over POIRepository)
 */

import { poiRepository } from "../repositories/poiRepository.js";

export const PoiModel = {
  findAll: () => poiRepository.findAll(),
  findByZonePolygon: (zonePolygon) => poiRepository.findByZonePolygon(zonePolygon),
  syncCityPoisWithTransaction: (poisData) => poiRepository.syncCityPoisWithTransaction(poisData),
  getDensitasDanDiversitasByZonePolygon: (zonePolygon) => poiRepository.getDensitasDanDiversitasByZonePolygon(zonePolygon),
  reclusterExistingPoisWithTransaction: (updates, deleteIds) => poiRepository.reclusterExistingPoisWithTransaction(updates, deleteIds),
  getLeakageReport: (limit) => poiRepository.getLeakageReport(limit),
};
