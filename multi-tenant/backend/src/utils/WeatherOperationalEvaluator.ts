/*
 * WeatherOperationalEvaluator.ts
 * Domain Utility for filtering weather forecast data during company operational hours (06:00 - 21:00)
 * and calculating Criteria C4 (Weather Risk Cost Score) in TypeScript.
 */

import { TimeSlotEvaluator, type TimeSlotName } from "./TimeSlotEvaluator.js";

export interface HourlyWeatherResponse {
  time?: string[];
  precipitation_probability?: number[];
  precipitation?: number[];
  rain?: number[];
  weather_code?: number[];
  wind_speed_10m?: number[];
  relative_humidity_2m?: number[];
  dew_point_2m?: number[];
  apparent_temperature?: number[];
  [key: string]: any;
}

export interface OperationalForecastRecord {
  time: string;
  hour: number;
  precipitation_probability: number;
  precipitation: number;
  rain: number;
  weather_code: number;
  wind_speed_10m: number;
  relative_humidity_2m: number;
  dew_point_2m: number;
  apparent_temperature: number;
}

export interface C4EvaluationResult {
  skor_c4: number;
  max_precipitation_probability: number;
  avg_precipitation_probability: number;
  supporting_info: {
    rain: number;
    weather_code: number;
    wind_speed: number;
    humidity: number;
    dew_point: number;
    temperature: number;
  };
  active_slot: TimeSlotName;
  is_off_hours: boolean;
}

export class WeatherOperationalEvaluator {
  /**
   * Filter hourly weather entries based on operational hours (06:00 - 21:00) or active slot
   */
  public static extractOperationalForecast(
    hourlyData: HourlyWeatherResponse = {},
    timeInput: string | Date = new Date()
  ): OperationalForecastRecord[] {
    if (!hourlyData || !Array.isArray(hourlyData.time)) {
      return [];
    }

    const slot = TimeSlotEvaluator.getSlot(timeInput);
    const results: OperationalForecastRecord[] = [];

    for (let i = 0; i < hourlyData.time.length; i++) {
      const timeStr = hourlyData.time[i];
      const dateObj = new Date(timeStr);
      const hours = dateObj.getHours();

      const isWithinCompanyHours = hours >= 6 && hours <= 21;

      let isWithinSlot = isWithinCompanyHours;
      if (slot === "pagi") isWithinSlot = hours >= 6 && hours <= 10;
      else if (slot === "siang") isWithinSlot = hours >= 11 && hours <= 14;
      else if (slot === "sore") isWithinSlot = hours >= 15 && hours <= 17;
      else if (slot === "malam") isWithinSlot = hours >= 18 && hours <= 21;
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
   */
  public static evaluateC4Score(
    hourlyData: HourlyWeatherResponse = {},
    timeInput: string | Date = new Date()
  ): C4EvaluationResult {
    const activeSlot = TimeSlotEvaluator.getSlot(timeInput);
    const isOffHours = activeSlot === "off_hours";

    const filtered = this.extractOperationalForecast(hourlyData, timeInput);
    if (filtered.length === 0) {
      return {
        skor_c4: 0,
        max_precipitation_probability: 0,
        avg_precipitation_probability: 0,
        supporting_info: {
          rain: 0,
          weather_code: 0,
          wind_speed: 0,
          humidity: 0,
          dew_point: 0,
          temperature: 0,
        },
        active_slot: activeSlot,
        is_off_hours: isOffHours,
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
      is_off_hours: isOffHours,
    };
  }
}
