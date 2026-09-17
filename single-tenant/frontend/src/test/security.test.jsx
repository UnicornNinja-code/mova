import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  sanitizeText,
  sanitizeCoordinates,
  sanitizeGeoJSON,
  sanitizeSearchQuery,
} from "@/lib/security/sanitizer";
import {
  loginInputSchema,
  gpsTelemetrySchema,
  poiSchema,
  competitorSchema,
} from "@/lib/security/validators";
import { createSafePopupContent } from "@/lib/security/safePopup";
import { useRateLimiter } from "@/hooks/useRateLimiter";

describe("Frontend Security Hardening & Sanitization", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Sanitizer Engine (Anti-XSS & Untrusted Inputs)", () => {
    it("strips script tags and dangerous HTML from untrusted text", () => {
      const maliciousInput = "<script>alert('hacked')</script>Warung Kopi <img src=x onerror=alert(1)>";
      const sanitized = sanitizeText(maliciousInput);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("<img");
      expect(sanitized).toBe("Warung Kopi");
    });

    it("strips null bytes and dangerous control characters", () => {
      const maliciousWithNull = "admin\0' OR '1'='1";
      const sanitized = sanitizeText(maliciousWithNull);
      expect(sanitized).not.toContain("\0");
      expect(sanitized).toBe("admin' OR '1'='1");
    });

    it("validates and rounds coordinates accurately", () => {
      const validCoord = sanitizeCoordinates("-6.2087634812", "106.8455991823");
      expect(validCoord.valid).toBe(true);
      expect(validCoord.latitude).toBe(-6.2087635);
      expect(validCoord.longitude).toBe(106.8455992);

      const invalidNaN = sanitizeCoordinates("invalid", 106.8);
      expect(invalidNaN.valid).toBe(false);

      const invalidOutOfBounds = sanitizeCoordinates(95.5, 106.8);
      expect(invalidOutOfBounds.valid).toBe(false);
    });

    it("validates GeoJSON structures and rejects malformed geometries", () => {
      const validPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [106.8, -6.2],
            [106.9, -6.2],
            [106.9, -6.1],
            [106.8, -6.1],
            [106.8, -6.2],
          ],
        ],
      };
      const result = sanitizeGeoJSON(validPolygon);
      expect(result.valid).toBe(true);

      const invalidPolygon = {
        type: "Polygon",
        coordinates: "not-an-array",
      };
      const invalidResult = sanitizeGeoJSON(invalidPolygon);
      expect(invalidResult.valid).toBe(false);
    });

    it("sanitizes search filter queries against regex/SQL trap characters", () => {
      const dirtyQuery = "'; DROP TABLE users; -- <script>";
      const cleanQuery = sanitizeSearchQuery(dirtyQuery);
      expect(cleanQuery).not.toContain(";");
      expect(cleanQuery).not.toContain("<");
      expect(cleanQuery).not.toContain("script");
      expect(cleanQuery).toBe("DROP TABLE users");
    });
  });

  describe("Zod Gatekeepers", () => {
    it("validates loginInputSchema and strips malicious payloads", () => {
      const dirtyInput = {
        identifier: "  <script>evil()</script>rider01  ",
        password: "securePassword123",
      };
      const parsed = loginInputSchema.safeParse(dirtyInput);
      expect(parsed.success).toBe(true);
      expect(parsed.data.identifier).toBe("rider01");
    });

    it("rejects GPS telemetry with out-of-range coordinates", () => {
      const invalidGps = {
        latitude: 120.5,
        longitude: 200.1,
        speed: 40,
        heading: 180,
      };
      const parsed = gpsTelemetrySchema.safeParse(invalidGps);
      expect(parsed.success).toBe(false);
    });

    it("validates and sanitizes POI catalog and competitor survey objects", () => {
      const dirtyPoi = {
        id: "poi-1",
        name: "<b>Starbucks Reserve</b> <script>",
        category: "Cafe",
        latitude: -6.2,
        longitude: 106.8,
      };
      const parsedPoi = poiSchema.safeParse(dirtyPoi);
      expect(parsedPoi.success).toBe(true);
      expect(parsedPoi.data.name).toBe("Starbucks Reserve");

      const dirtyComp = {
        brand_name: "<marquee>Kopi Kenangan</marquee>",
        latitude: -6.21,
        longitude: 106.81,
        status: "CONFIRMED",
      };
      const parsedComp = competitorSchema.safeParse(dirtyComp);
      expect(parsedComp.success).toBe(true);
      expect(parsedComp.data.brand_name).toBe("Kopi Kenangan");
    });
  });

  describe("Safe Leaflet DOM Popup Engine", () => {
    it("constructs secure DOM nodes without string interpolation XSS", () => {
      const maliciousTitle = "<img src=x onerror=alert('xss')>Kopi Janji Jiwa";
      const popupEl = createSafePopupContent({
        title: maliciousTitle,
        subtitle: "Coffee Shop",
        fields: [{ label: "Crowd Score", value: 0.85 }],
      });

      expect(popupEl instanceof HTMLElement).toBe(true);
      expect(popupEl.querySelector("img")).toBeNull();
      expect(popupEl.textContent).toContain("Kopi Janji Jiwa");
      expect(popupEl.textContent).toContain("Crowd Score");
    });
  });

  describe("Client-Side Rate Limiter & Brute Force Defense", () => {
    it("locks user out after exceeding max failed login attempts", () => {
      const { result } = renderHook(() =>
        useRateLimiter({ maxAttempts: 3, baseCooldownSeconds: 10, storageKey: "test_rate_limit" })
      );

      expect(result.current.isLocked).toBe(false);
      expect(result.current.failedAttempts).toBe(0);

      // Attempt 1 & 2: still unlocked
      act(() => {
        result.current.recordFailure();
        result.current.recordFailure();
      });
      expect(result.current.isLocked).toBe(false);
      expect(result.current.failedAttempts).toBe(2);

      // Attempt 3: triggers lockout cooldown
      act(() => {
        result.current.recordFailure();
      });
      expect(result.current.isLocked).toBe(true);
      expect(result.current.failedAttempts).toBe(3);
      expect(result.current.remainingSeconds).toBeGreaterThan(0);

      // Reset
      act(() => {
        result.current.resetRateLimit();
      });
      expect(result.current.isLocked).toBe(false);
      expect(result.current.failedAttempts).toBe(0);
    });
  });
});
