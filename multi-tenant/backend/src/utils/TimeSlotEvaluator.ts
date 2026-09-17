/*
 * TimeSlotEvaluator.ts
 * Domain Utility Value Object / Strategy for evaluating time-based crowd slots in TypeScript.
 */

export type TimeSlotName = "pagi" | "siang" | "sore" | "malam" | "off_hours";

export class TimeSlotEvaluator {
  /**
   * Determine time slot string from date object or HH:mm string.
   */
  public static getSlot(timeInput: Date | string = new Date()): TimeSlotName {
    let hours: number;
    let minutes: number;

    if (timeInput instanceof Date) {
      hours = timeInput.getHours();
      minutes = timeInput.getMinutes();
    } else if (typeof timeInput === "string" && timeInput.includes(":")) {
      const parts = timeInput.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10) || 0;
    } else if (
      typeof timeInput === "string" &&
      ["pagi", "siang", "sore", "malam"].includes(timeInput.toLowerCase())
    ) {
      return timeInput.toLowerCase() as TimeSlotName;
    } else {
      const now = new Date();
      hours = now.getHours();
      minutes = now.getMinutes();
    }

    const totalMinutes = hours * 60 + minutes;

    // 06:00 = 360 min, 10:59 = 659 min
    if (totalMinutes >= 360 && totalMinutes <= 659) {
      return "pagi";
    }
    // 11:00 = 660 min, 14:59 = 899 min
    if (totalMinutes >= 660 && totalMinutes <= 899) {
      return "siang";
    }
    // 15:00 = 900 min, 17:59 = 1079 min
    if (totalMinutes >= 900 && totalMinutes <= 1079) {
      return "sore";
    }
    // 18:00 = 1080 min, 21:00 = 1260 min
    if (totalMinutes >= 1080 && totalMinutes <= 1260) {
      return "malam";
    }

    return "off_hours";
  }

  /**
   * Get corresponding score column name for database query.
   */
  public static getColumnName(slot: string): string | null {
    const validSlots = ["pagi", "siang", "sore", "malam"];
    if (validSlots.includes(slot)) {
      return `score_${slot}`;
    }
    return null;
  }
}
