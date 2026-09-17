/*
 * protocolRoadModel.ts
 * Backward-Compatible Wrapper over RoadRepository in TypeScript
 */

import { roadRepository } from "../repositories/roadRepository.js";

export const ProtocolRoadModel = {
  findAll: () => roadRepository.findAll(),
  truncate: () => roadRepository.truncate(),
  bulkCreate: (roadsData: any[]) => roadRepository.bulkCreate(roadsData),
};
