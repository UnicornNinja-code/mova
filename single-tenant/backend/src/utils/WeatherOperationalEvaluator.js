/*
 * WeatherOperationalEvaluator.js
 * Domain Utility for filtering weather forecast data during company operational hours (06:00 - 21:00)
 * and calculating Criteria C4 (Weather Risk Cost Score).
 */

import { TimeSlotEvaluator } from "./TimeSlotEvaluator.js";

const COMPANY_OPEN_HOUR = 6;
const COMPANY_CLOSE_HOUR = 21;

const PAGI_START_HOUR = 6;
const PAGI_END_HOUR = 10;
const SIANG_START_HOUR = 11;
const SIANG_END_HOUR = 14;
const SORE_START_HOUR = 15;
const SORE_END_HOUR = 17;
const MALAM_START_HOUR = 18;
const MALAM_END_HOUR = 21;

export class WeatherOperationalEvaluator {
  /**
   * Filter hourly weather entries based on operational hours (06:00 - 21:00) or active slot
   * @param {object} hourlyData - Open-Meteo hourly object { time: [], precipitation_probability: [], ... }
   * @param {string|Date} timeInput - Optional target slot name or date
   * @returns {Array<object>} Array of hourly weather records within operational window
   */
  static extractOperationalForecast(hourlyData = {}, timeInput = new Date()) {
    if (!hourlyData || !Array.isArray(hourlyData.time)) {
      return [];
    }

    const slot = TimeSlotEvaluator.getSlot(timeInput);
    const results = [];

    for (let i = 0; i < hourlyData.time.length; i++) {
      const timeStr = hourlyData.time[i];
      const dateObj = new Date(timeStr);
      const hours = dateObj.getHours();

      // Company total operational hours: 06:00 - 21:00
      const isWithinCompanyHours = hours >= COMPANY_OPEN_HOUR && hours <= COMPANY_CLOSE_HOUR;

      // Slot-specific filter if requested
      let isWithinSlot = isWithinCompanyHours;
      if (slot === "pagi") isWithinSlot = hours >= PAGI_START_HOUR && hours <= PAGI_END_HOUR;
      else if (slot === "siang") isWithinSlot = hours >= SIANG_START_HOUR && hours <= SIANG_END_HOUR;
      else if (slot === "sore") isWithinSlot = hours >= SORE_START_HOUR && hours <= SORE_END_HOUR;
      else if (slot === "malam") isWithinSlot = hours >= MALAM_START_HOUR && hours <= MALAM_END_HOUR;
      else if (slot === "off_hours") isWithinSlot = false;

      if (isWithinSlot) {
        results.push({
          time: timeStr,
          hour: hours,
          precipitation_probability: hourlyData.precipitation_probability?.[i] ?? 0,
          precipitation: hourlyData.precipitation?.[i] ?? 0,
          rain: hourlyData.rain?.[i] ?? 0,
          weather_code: hourlyData.weather_code?.[i] ?? 0,
          wind_speed_10m: hourlyData.wind_speed_10m?.[i] ?? 0,
          relative_humidity_2m: hourlyData.relative_humidity_2m?.[i] ?? 0,
          dew_point_2m: hourlyData.dew_point_2m?.[i] ?? 0,
          apparent_temperature: hourlyData.apparent_temperature?.[i] ?? 0,
        });
      }
    }


    // Fallback: If no records match specific slot, return all company operational hours (06:00 - 21:00)
    if (results.length === 0 && slot !== "off_hours") {
      for (let i = 0; i < hourlyData.time.length; i++) {
        const dateObj = new Date(hourlyData.time[i]);
        const hours = dateObj.getHours();
        if (hours >= 6 && hours <= 21) {
          results.push({
            time: hourlyData.time[i],
            hour: hours,
            precipitation_probability: hourlyData.precipitation_probability?.[i] ?? 0,
            precipitation: hourlyData.precipitation?.[i] ?? 0,
            rain: hourlyData.rain?.[i] ?? 0,
            weather_code: hourlyData.weather_code?.[i] ?? 0,
            wind_speed_10m: hourlyData.wind_speed_10m?.[i] ?? 0,
            relative_humidity_2m: hourlyData.relative_humidity_2m?.[i] ?? 0,
            dew_point_2m: hourlyData.dew_point_2m?.[i] ?? 0,
            apparent_temperature: hourlyData.apparent_temperature?.[i] ?? 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Evaluate Criteria C4 (Cost) score and extract UI supporting weather info
   * @param {object} hourlyData 
   * @param {string|Date} timeInput 
   * @returns {object} { skor_c4, max_precipitation_probability, avg_precipitation_probability, supporting_info, active_slot, is_off_hours }
   */
  static evaluateC4Score(hourlyData = {}, timeInput = new Date()) {
    const activeSlot = TimeSlotEvaluator.getSlot(timeInput);
    if (activeSlot === "off_hours") {
      return {
        skor_c4: 0,
        max_precipitation_probability: 0,
        avg_precipitation_probability: 0,
        data_quality: "VALID",
        source: "OPEN_METEO",
        supporting_info: {
          rain: 0,
          weather_code: 0,
          wind_speed: 0,
          humidity: 0,
          dew_point: 0,
          temperature: 0,
        },
        active_slot: "off_hours",
        is_off_hours: true,
      };
    }

    const filtered = this.extractOperationalForecast(hourlyData, timeInput);
    if (filtered.length === 0) {
      // CONSERVATIVE FALLBACK: Do not set 0% because C4 is a COST criterion. 0% would wrongly favor zones with missing weather data.
      return {
        skor_c4: 50, // Conservative neutral 50% precipitation risk
        max_precipitation_probability: 50,
        avg_precipitation_probability: 50,
        data_quality: "DEGRADED",
        source: "CONSERVATIVE_BASELINE",
        warning: "WEATHER_UNAVAILABLE_CONSERVATIVE_FALLBACK",
        supporting_info: {
          rain: 0,
          weather_code: 0,
          wind_speed: 0,
          humidity: 0,
          dew_point: 0,
          temperature: 28,
        },
        active_slot: activeSlot,
        is_off_hours: false,
      };
    }

    let maxProb = 0;
    let sumProb = 0;
    let sumRain = 0;
    let sumWind = 0;
    let sumHumidity = 0;
    let sumDew = 0;
    let sumTemp = 0;
    let latestWeatherCode = filtered[0].weather_code;

    for (const item of filtered) {
      if (item.precipitation_probability > maxProb) {
        maxProb = item.precipitation_probability;
      }
      sumProb += item.precipitation_probability;
      sumRain += item.rain;
      sumWind += item.wind_speed_10m;
      sumHumidity += item.relative_humidity_2m;
      sumDew += item.dew_point_2m;
      sumTemp += item.apparent_temperature;
    }

    const count = filtered.length;
    const avgProb = Math.round((sumProb / count) * 100) / 100;

    return {
      skor_c4: maxProb, // C4 Cost Criteria = Max Precipitation Probability % during operational hours
      max_precipitation_probability: maxProb,
      avg_precipitation_probability: avgProb,
      supporting_info: {
        rain: Math.round((sumRain / count) * 100) / 100,
        weather_code: latestWeatherCode,
        wind_speed: Math.round((sumWind / count) * 100) / 100,
        humidity: Math.round((sumHumidity / count) * 100) / 100,
        dew_point: Math.round((sumDew / count) * 100) / 100,
        temperature: Math.round((sumTemp / count) * 100) / 100,
      },
      active_slot: activeSlot,
      is_off_hours: false,
    };
  }

  /**
   * Helper to map WMO weather codes to human readable Indonesian labels & icon identifiers
   */
  static getWmoMeta(code = 0) {
    if (code === 0) return { label: "Cerah", icon: "sun", severity: "LOW" };
    if ([1, 2].includes(code)) return { label: "Cerah Berawan", icon: "cloud-sun", severity: "LOW" };
    if (code === 3) return { label: "Berawan", icon: "cloud", severity: "LOW" };
    if ([45, 48].includes(code)) return { label: "Berkabut", icon: "smog", severity: "MEDIUM" };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: "Gerimis", icon: "cloud-drizzle", severity: "MEDIUM" };
    if ([61, 63, 65, 66, 67].includes(code)) return { label: "Hujan Ringan", icon: "cloud-rain", severity: "HIGH" };
    if ([80, 81, 82].includes(code)) return { label: "Hujan Deras", icon: "cloud-showers-heavy", severity: "HIGH" };
    if ([95, 96, 99].includes(code)) return { label: "Badai Petir", icon: "cloud-bolt", severity: "CRITICAL" };
    return { label: "Berawan", icon: "cloud", severity: "LOW" };
  }

  /**
   * Extract Hourly Weather Timeline Paired with Time Slots for Today or Tomorrow
   * @param {object} params
   * @param {object} params.hourlyData - Open-Meteo hourly object
   * @param {string|Date} params.targetDate - "today", "tomorrow", or ISO date string (YYYY-MM-DD)
   * @param {string} params.targetSlot - "pagi", "siang", "sore", "malam", or "all"
   * @returns {object} { target_date, selected_slot, slot_summary, hourly_timeline, available_slots }
   */
  static extractHourlyTimeline({ hourlyData = {}, targetDate = "today", targetSlot = "all" }) {
    if (!hourlyData || !Array.isArray(hourlyData.time)) {
      return {
        target_date: targetDate,
        selected_slot: targetSlot,
        slot_summary: {
          label: "Data Tidak Tersedia",
          avg_temperature_c: 0,
          max_rain_probability: 0,
          dominant_condition: "Unknown",
          skor_c4_dss: 50,
          risk_level: "UNKNOWN",
        },
        hourly_timeline: [],
        available_slots: {},
      };
    }

    // Resolve target date string YYYY-MM-DD
    let targetDateStr = "";
    const now = new Date();
    if (targetDate === "today" || !targetDate) {
      targetDateStr = now.toISOString().split("T")[0];
    } else if (targetDate === "tomorrow") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDateStr = tomorrow.toISOString().split("T")[0];
    } else if (typeof targetDate === "string" && targetDate.includes("-")) {
      targetDateStr = targetDate.split("T")[0];
    } else {
      targetDateStr = now.toISOString().split("T")[0];
    }

    const slotDefinitions = {
      pagi: { label: "Pagi (06:00 - 10:00)", startHour: 6, endHour: 10 },
      siang: { label: "Siang (11:00 - 14:00)", startHour: 11, endHour: 14 },
      sore: { label: "Sore (15:00 - 17:00)", startHour: 15, endHour: 17 },
      malam: { label: "Malam (18:00 - 21:00)", startHour: 18, endHour: 21 },
    };

    // Parse all hourly items for the target date
    const allDateHours = [];
    for (let i = 0; i < hourlyData.time.length; i++) {
      const timeStr = hourlyData.time[i]; // e.g. "2026-09-10T08:00"
      if (!timeStr.startsWith(targetDateStr)) continue;

      const dateObj = new Date(timeStr);
      const hour = dateObj.getHours();

      // Determine slot
      let slotKey = null;
      if (hour >= 6 && hour <= 10) slotKey = "pagi";
      else if (hour >= 11 && hour <= 14) slotKey = "siang";
      else if (hour >= 15 && hour <= 17) slotKey = "sore";
      else if (hour >= 18 && hour <= 21) slotKey = "malam";

      const weatherCode = hourlyData.weather_code?.[i] ?? 0;
      const wmoMeta = this.getWmoMeta(weatherCode);

      allDateHours.push({
        time: timeStr.includes("T") ? timeStr.split("T")[1].slice(0, 5) : `${String(hour).padStart(2, '0')}:00`,
        full_time: timeStr,
        hour,
        slot: slotKey,
        temperature_c: Math.round((hourlyData.apparent_temperature?.[i] ?? hourlyData.temperature_2m?.[i] ?? 28) * 10) / 10,
        rain_probability_percent: hourlyData.precipitation_probability?.[i] ?? 0,
        rain_volume_mm: hourlyData.rain?.[i] ?? hourlyData.precipitation?.[i] ?? 0,
        weather_code: weatherCode,
        weather_label: wmoMeta.label,
        icon: wmoMeta.icon,
        severity: wmoMeta.severity,
        wind_speed_kmh: hourlyData.wind_speed_10m?.[i] ?? 0,
        humidity_percent: hourlyData.relative_humidity_2m?.[i] ?? 0,
        dew_point_c: hourlyData.dew_point_2m?.[i] ?? 0,
      });
    }

    // Build summaries for all 4 slots
    const availableSlots = {};
    for (const [key, def] of Object.entries(slotDefinitions)) {
      const slotItems = allDateHours.filter((h) => h.slot === key);
      if (slotItems.length > 0) {
        const maxRain = Math.max(...slotItems.map((s) => s.rain_probability_percent));
        const avgRain = Math.round(slotItems.reduce((sum, s) => sum + s.rain_probability_percent, 0) / slotItems.length);
        const avgTemp = Math.round((slotItems.reduce((sum, s) => sum + s.temperature_c, 0) / slotItems.length) * 10) / 10;
        const dominantWeather = slotItems[Math.floor(slotItems.length / 2)]?.weather_label || "Cerah";

        availableSlots[key] = {
          slot_key: key,
          label: def.label,
          hours_count: slotItems.length,
          avg_temperature_c: avgTemp,
          max_rain_probability: maxRain,
          avg_rain_probability: avgRain,
          dominant_condition: dominantWeather,
          skor_c4_dss: maxRain,
          risk_level: maxRain > 60 ? "HIGH" : maxRain > 30 ? "MEDIUM" : "LOW",
        };
      }
    }

    // Filter timeline based on targetSlot
    let selectedTimeline = allDateHours.filter((h) => h.hour >= 6 && h.hour <= 21); // default all company hours
    if (targetSlot && targetSlot !== "all" && slotDefinitions[targetSlot]) {
      selectedTimeline = allDateHours.filter((h) => h.slot === targetSlot);
    }

    // Slot summary for selected slot
    const activeSummary = availableSlots[targetSlot] || {
      slot_key: targetSlot,
      label: targetSlot === "all" ? "Seluruh Jam Operasional (06:00 - 21:00)" : targetSlot,
      avg_temperature_c: selectedTimeline.length > 0 ? Math.round((selectedTimeline.reduce((sum, s) => sum + s.temperature_c, 0) / selectedTimeline.length) * 10) / 10 : 28,
      max_rain_probability: selectedTimeline.length > 0 ? Math.max(...selectedTimeline.map((s) => s.rain_probability_percent)) : 0,
      dominant_condition: selectedTimeline[0]?.weather_label || "Cerah",
      skor_c4_dss: selectedTimeline.length > 0 ? Math.max(...selectedTimeline.map((s) => s.rain_probability_percent)) : 0,
      risk_level: "LOW",
    };

    return {
      target_date: targetDateStr,
      selected_slot: targetSlot,
      slot_summary: activeSummary,
      hourly_timeline: selectedTimeline,
      available_slots: availableSlots,
    };
  }
}

