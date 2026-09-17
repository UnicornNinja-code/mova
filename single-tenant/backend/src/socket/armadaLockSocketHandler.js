/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   armadaLockSocketHandler.js (Delegates to Canonical eventPublisher for backward compatibility)
 */

import { eventPublisher } from "../events/eventPublisher.js";

/**
 * Broadcast Real-Time Armada Ticket-Booking Lock (Hold Status)
 */
export const broadcastArmadaHeld = ({ armadaId, code, riderId, riderName }) => {
  return eventPublisher.publishArmadaHeld({ armadaId, code, riderId, riderName });
};

/**
 * Broadcast Real-Time Armada Lock Release
 */
export const broadcastArmadaReleased = ({ armadaId, code }) => {
  return eventPublisher.publishArmadaReleased({ armadaId, code });
};

/**
 * Send Real-Time Distribution Assignment Notification to Specific Rider
 */
export const sendRiderAssignmentNotification = ({ assignmentId, riderId, zoneName, topsisRank, assignmentType }) => {
  return eventPublisher.publishRiderAssigned({ assignmentId, riderId, zoneName, topsisRank, assignmentType });
};
