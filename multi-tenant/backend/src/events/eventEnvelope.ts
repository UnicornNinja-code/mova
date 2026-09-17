/*
 * eventEnvelope.ts
 * Standardized Event Envelope Builder & Idempotency Key Generator
 */

export interface EventEnvelopeOptions<T = any> {
  eventId: string;
  type: string;
  data?: T;
  timestamp?: string | null;
}

export interface EventEnvelope<T = any> {
  event_id: string;
  type: string;
  timestamp: string;
  data: T;
}

export function createEventEnvelope<T = any>({
  eventId,
  type,
  data,
  timestamp = null,
}: EventEnvelopeOptions<T>): EventEnvelope<T> {
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
    data: (data || {}) as T,
  };
}

export function generateDeterministicEventId(
  prefix: string,
  entityId: string | number,
  suffix: string | number | null = null
): string {
  if (!prefix || !entityId) {
    throw new Error("prefix dan entityId diperlukan untuk membuat deterministic event_id.");
  }
  return suffix ? `evt_${prefix}_${entityId}_${suffix}` : `evt_${prefix}_${entityId}`;
}

export function generateSlidingWindowDeduplicationId(
  prefix: string,
  entityId: string | number,
  windowSeconds: number = 10
): string {
  const timeWindowBucket = Math.floor(Date.now() / (windowSeconds * 1000));
  return `evt_${prefix}_${entityId}_${timeWindowBucket}`;
}
