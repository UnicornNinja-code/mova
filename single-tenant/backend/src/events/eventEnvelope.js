/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   eventEnvelope.js (Standardized Event Envelope Builder & Idempotency Key Generator)
 */

/**
 * Standard Event Envelope Structure
 */
export function createEventEnvelope({ eventId, type, data, timestamp = null }) {
  if (!eventId) {
    throw new Error("eventId wajib disertakan dalam event envelope.");
  }
  if (!type) {
    throw new Error("type wajib disertakan dalam event envelope.");
  }

  return {
    event_id: eventId,
    type,
    timestamp: timestamp || new Date().toISOString(),
    data: data || {},
  };
}

/**
 * Deterministic Idempotency Key Generator
 * Guarantees that retries or reconnection bursts produce the same event_id
 */
export function generateDeterministicEventId(prefix, entityId, suffix = null) {
  if (!prefix || !entityId) {
    throw new Error("prefix dan entityId diperlukan untuk membuat deterministic event_id.");
  }
  return suffix ? `evt_${prefix}_${entityId}_${suffix}` : `evt_${prefix}_${entityId}`;
}

/**
 * Time-Window Sliding Deduplication Key Generator for Transient Events (e.g. Geofence Breaches)
 * Deduplicates multiple socket emissions within a sliding window (default 10 seconds)
 */
export function generateSlidingWindowDeduplicationId(prefix, entityId, windowSeconds = 10) {
  const timeWindowBucket = Math.floor(Date.now() / (windowSeconds * 1000));
  return `evt_${prefix}_${entityId}_${timeWindowBucket}`;
}
