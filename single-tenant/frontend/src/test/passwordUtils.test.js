import { describe, it, expect } from "vitest";
import {
  checkPasswordStrength,
  checkPasswordMatch,
  passwordSetupSchema,
} from "@/lib/passwordUtils";

describe("🔐 passwordUtils — Strength and Real-Time Match Validation Suite", () => {
  describe("checkPasswordStrength", () => {
    it("returns score 0 for empty password", () => {
      const result = checkPasswordStrength("");
      expect(result.score).toBe(0);
      expect(result.label).toBe("Kosong");
      expect(result.isStrong).toBe(false);
    });

    it("returns weak for passwords not meeting enough criteria", () => {
      const result = checkPasswordStrength("abc");
      expect(result.score).toBe(1);
      expect(result.label).toBe("Lemah");
      expect(result.isStrong).toBe(false);
    });

    it("returns medium for 3 matching criteria", () => {
      const result = checkPasswordStrength("Abcdefgh"); // length, upper, lower (no number)
      expect(result.score).toBe(2);
      expect(result.label).toBe("Sedang");
      expect(result.isStrong).toBe(false);
    });

    it("returns strong when length, uppercase, lowercase, and numbers are satisfied", () => {
      const result = checkPasswordStrength("MovaSuper2026");
      expect(result.score).toBe(3);
      expect(result.label).toBe("Kuat");
      expect(result.isStrong).toBe(true);
    });
  });

  describe("checkPasswordMatch", () => {
    it("returns idle status when confirmPassword is empty", () => {
      const result = checkPasswordMatch("MyPassword123", "");
      expect(result.status).toBe("idle");
      expect(result.isMatching).toBe(false);
      expect(result.message).toBe("");
    });

    it("returns mismatch status when passwords differ", () => {
      const result = checkPasswordMatch("MyPassword123", "MyPassword12");
      expect(result.status).toBe("mismatch");
      expect(result.isMatching).toBe(false);
      expect(result.message).toBe("Kata sandi belum cocok");
    });

    it("returns match status when passwords are identical", () => {
      const result = checkPasswordMatch("MyPassword123", "MyPassword123");
      expect(result.status).toBe("match");
      expect(result.isMatching).toBe(true);
      expect(result.message).toBe("Kata sandi cocok");
    });
  });

  describe("passwordSetupSchema", () => {
    it("validates compliant matching passwords", () => {
      const validData = {
        password: "ValidPass123",
        confirmPassword: "ValidPass123",
      };
      const parseResult = passwordSetupSchema.safeParse(validData);
      expect(parseResult.success).toBe(true);
    });

    it("rejects mismatched passwords with validation error", () => {
      const invalidData = {
        password: "ValidPass123",
        confirmPassword: "DifferentPass123",
      };
      const parseResult = passwordSetupSchema.safeParse(invalidData);
      expect(parseResult.success).toBe(false);
      expect(parseResult.error?.errors[0]?.message).toBe("Konfirmasi kata sandi tidak cocok");
    });
  });
});
