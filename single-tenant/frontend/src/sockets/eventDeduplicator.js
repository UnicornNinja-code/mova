/**
 * Sliding-Window Event Deduplicator.
 * Prevents duplicate render cycles, audio alerts, and toast triggers
 * by tracking deterministic `event_id` keys over a sliding time window (default 30 seconds).
 */
export class EventDeduplicator {
  constructor(ttlMs = 30000) {
    this.ttlMs = ttlMs;
    this.seenEvents = new Map(); // event_id -> timestamp
  }

  /**
   * Checks if an event is novel (not seen within ttlMs window).
   * @param {string} eventId - Unique deterministic event ID (e.g. evt_assign_xxx, evt_sale_xxx)
   * @returns {boolean} true if event is unique and processed, false if duplicate
   */
  shouldProcess(eventId) {
    if (!eventId) return true;

    this.cleanup();

    const now = Date.now();
    if (this.seenEvents.has(eventId)) {
      return false; // Duplicate detected
    }

    this.seenEvents.set(eventId, now);
    return true;
  }

  /**
   * Removes expired event entries outside the sliding window.
   */
  cleanup() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, time] of this.seenEvents.entries()) {
      if (time < cutoff) {
        this.seenEvents.delete(id);
      }
    }
  }

  /**
   * Clears all recorded event IDs (e.g. upon user logout).
   */
  clear() {
    this.seenEvents.clear();
  }
}

export const defaultDeduplicator = new EventDeduplicator();
