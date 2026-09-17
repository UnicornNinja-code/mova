/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   ProtocolRoadModel (Backward-Compatible Wrapper over RoadRepository)
 */

import { roadRepository } from "../repositories/roadRepository.js";

export const ProtocolRoadModel = {
  findAll: () => roadRepository.findAll(),
  truncate: () => roadRepository.truncate(),
  bulkCreate: (roadsData) => roadRepository.bulkCreate(roadsData),
};
