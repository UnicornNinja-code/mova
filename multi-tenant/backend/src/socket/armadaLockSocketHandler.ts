/*
 * armadaLockSocketHandler.ts
 * Delegates to Canonical eventPublisher for backward compatibility in TypeScript
 */

import { eventPublisher } from "../events/eventPublisher.js";

/**
 * Broadcast Real-Time Armada Ticket-Booking Lock (Hold Status)
 */
export const broadcastArmadaHeld = ({
  armadaId,
  code,
  riderId,
  riderName,
}: {
  armadaId: string | number;
  code: string;
  riderId: string | number;
  riderName: string;
}) => {
  return eventPublisher.publishArmadaHeld({ armadaId, code, riderId, riderName });
};

/**
 * Broadcast Real-Time Armada Lock Release
 */
export const broadcastArmadaReleased = ({
  armadaId,
  code,
}: {
  armadaId: string | number;
  code: string;
}) => {
  return eventPublisher.publishArmadaReleased({ armadaId, code });
};

/**
 * Send Real-Time Distribution Assignment Notification to Specific Rider
 */
export const sendRiderAssignmentNotification = ({
  assignmentId,
  riderId,
  zoneName,
  topsisRank,
  assignmentType,
}: {
  assignmentId: string | number;
  riderId: string | number;
  zoneName: string;
  topsisRank?: number;
  assignmentType?: string;
}) => {
  return eventPublisher.publishRiderAssigned({ assignmentId, riderId, zoneName, topsisRank, assignmentType });
};
