/**
 * validators.js
 * Central Zod Schemas for runtime gatekeeping of external/untrusted data.
 */

import { z } from "zod";
import { sanitizeText, sanitizeCoordinates } from "./sanitizer";

// Custom coordinate validator
const coordinateRefinement = (val) => {
  const result = sanitizeCoordinates(val.latitude, val.longitude);
  return result.valid;
};

// --- Auth Schemas ---
export const loginInputSchema = z.object({
  identifier: z
    .string()
    .min(3, "Identifier minimal 3 karakter")
    .max(100, "Identifier maksimal 100 karakter")
    .transform((val) => sanitizeText(val, { maxLength: 100 })),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter")
    .max(128, "Password maksimal 128 karakter"),
  turnstileToken: z.string().optional(),
});

// --- GPS Telemetry Schema ---
export const gpsTelemetrySchema = z
  .object({
    latitude: z.number().or(z.string().transform(Number)),
    longitude: z.number().or(z.string().transform(Number)),
    speed: z.number().min(0).max(300).optional().default(0),
    heading: z.number().min(0).max(360).optional().default(0),
    accuracy: z.number().min(0).max(1000).optional(),
    timestamp: z.string().or(z.number()).optional(),
  })
  .refine(coordinateRefinement, {
    message: "Koordinat GPS tidak valid (di luar rentang WGS84)",
  });

// --- POI Inbound Schema ---
export const poiSchema = z.object({
  id: z.string().or(z.number()),
  name: z
    .string()
    .min(1)
    .max(255)
    .transform((val) => sanitizeText(val, { maxLength: 255 })),
  category: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeText(val, { maxLength: 100 }) : "UNKNOWN")),
  latitude: z.number().or(z.string().transform(Number)),
  longitude: z.number().or(z.string().transform(Number)),
  source: z.string().optional().default("OSM"),
  crowd_level: z.number().min(0).max(1).optional(),
});

// --- Competitor Survey Schema ---
export const competitorSchema = z.object({
  id: z.string().or(z.number()).optional(),
  brand_name: z
    .string()
    .min(1, "Nama brand wajib diisi")
    .max(150)
    .transform((val) => sanitizeText(val, { maxLength: 150 })),
  zone_id: z.string().or(z.number()).optional(),
  latitude: z.number().or(z.string().transform(Number)),
  longitude: z.number().or(z.string().transform(Number)),
  price_range: z.string().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED", "UNLINKED", "RECONCILED"]).optional(),
});

// --- Zone Master Schema ---
export const zoneInputSchema = z.object({
  name: z
    .string()
    .min(3, "Nama zona minimal 3 karakter")
    .max(100)
    .transform((val) => sanitizeText(val, { maxLength: 100 })),
  code: z
    .string()
    .min(2)
    .max(50)
    .transform((val) => sanitizeText(val, { maxLength: 50 })),
  polygon: z.object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.any()),
  }),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional().default("ACTIVE"),
});
