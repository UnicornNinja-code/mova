/*
 * TimeSlotEvaluator.js
 * Domain Utility Value Object / Strategy for evaluating time-based crowd slots.
 *
 * Interval breakdown:
 * - pagi: 06:00 - 10:59 (360 - 659 min)
 * - siang: 11:00 - 14:59 (660 - 899 min)
 * - sore: 15:00 - 17:59 (900 - 1079 min)
 * - malam: 18:00 - 21:00 (1080 - 1260 min)
 * - off_hours: Outside 06:00 - 21:00 (default score = 1)
 */

const SLOT_PAGI_START_MIN = 360;
const SLOT_PAGI_END_MIN = 659;
const SLOT_SIANG_START_MIN = 660;
const SLOT_SIANG_END_MIN = 899;
const SLOT_SORE_START_MIN = 900;
const SLOT_SORE_END_MIN = 1079;
const SLOT_MALAM_START_MIN = 1080;
const SLOT_MALAM_END_MIN = 1260;

const VALID_SLOTS = ["pagi", "siang", "sore", "malam"];

export class TimeSlotEvaluator {
  /**
   * Determine time slot string from date object or HH:mm string.
   * @param {Date|string} timeInput 
   * @returns {'pagi'|'siang'|'sore'|'malam'|'off_hours'}
   */
  static getSlot(timeInput = new Date()) {
    let hours, minutes;

    if (timeInput instanceof Date) {
      hours = timeInput.getHours();
      minutes = timeInput.getMinutes();
    } else if (typeof timeInput === "string" && timeInput.includes(":")) {
      const parts = timeInput.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10) || 0;
    } else if (typeof timeInput === "string" && VALID_SLOTS.includes(timeInput.toLowerCase())) {
      return timeInput.toLowerCase();
    } else {
      const now = new Date();
      hours = now.getHours();
      minutes = now.getMinutes();
    }

    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes >= SLOT_PAGI_START_MIN && totalMinutes <= SLOT_PAGI_END_MIN) {
      return "pagi";
    }
    if (totalMinutes >= SLOT_SIANG_START_MIN && totalMinutes <= SLOT_SIANG_END_MIN) {
      return "siang";
    }
    if (totalMinutes >= SLOT_SORE_START_MIN && totalMinutes <= SLOT_SORE_END_MIN) {
      return "sore";
    }
    if (totalMinutes >= SLOT_MALAM_START_MIN && totalMinutes <= SLOT_MALAM_END_MIN) {
      return "malam";
    }

    return "off_hours";
  }

  /**
   * Get corresponding score column name for database query.
   * @param {string} slot 
   * @returns {string|null} e.g. "score_pagi"
   */
  static getColumnName(slot) {
    if (VALID_SLOTS.includes(slot)) {
      return `score_${slot}`;
    }
    return null;
  }
}

