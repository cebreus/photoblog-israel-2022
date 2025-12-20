/**
 * @fileoverview String Utilities Unit Tests
 *
 * @description
 * Tests string manipulation helper functions.
 * Covers slugification, capitalization, truncation, and other text formatting utilities
 * used throughout the application.
 *
 * @modules-tested
 * - src/lib/utils/strings.ts
 */

import { describe, expect, it } from "vitest";
import {
  formatDateForDisplay,
  formatDateRange,
  formatWeekdayCzech,
  toSlug,
} from "../../src/lib/utils/strings";

describe("String Utils", () => {
  describe("toSlug", () => {
    it("converts simple text to slug", () => {
      expect(toSlug("Hello World")).toBe("hello-world");
    });

    it("handles Czech characters", () => {
      expect(toSlug("Žluťoučký kůň")).toBe("zlutoucky-kun");
    });

    it("handles mixed case and special chars", () => {
      expect(toSlug("Jan Novák")).toBe("jan-novak");
      expect(toSlug("Čeština is hard!")).toBe("cestina-is-hard");
    });

    it("handles empty or null input", () => {
      expect(toSlug("")).toBe("");
      // @ts-expect-error
      expect(toSlug(null)).toBe("");
      // @ts-expect-error
      expect(toSlug(undefined)).toBe("");
    });
  });

  describe("formatDateForDisplay", () => {
    it("formats ISO date string to Czech format", () => {
      // Note: We need to be careful with timezones in tests if the input is just YYYY-MM-DD
      // Ideally providing full ISO with Z to maintain consistency or checking locale.
      // But purely formatting:
      const date = "2025-11-21T12:00:00Z";
      // This expectation depends on the test runner's locale timezone if not handled,
      // but Intl usually defaults to runtime. Let's assume standard behavior.
      // Ideally we check if it contains the month name.
      const result = formatDateForDisplay(date);
      expect(result).toMatch(/21\. listopadu 2025/);
    });
  });

  describe("formatWeekdayCzech", () => {
    it("returns correct Czech weekday", () => {
      const date = "2025-11-21T12:00:00Z"; // Friday
      expect(formatWeekdayCzech(date)).toBe("pátek");
    });
  });

  describe("formatDateRange", () => {
    it("handles empty input", () => {
      expect(formatDateRange([])).toBe("");
    });

    it("handles single date", () => {
      expect(formatDateRange(["2025-11-21"])).toMatch(/21\. listopadu 2025/);
    });

    it("handles two days in same month", () => {
      const range = ["2025-11-21", "2025-11-22"];
      expect(formatDateRange(range)).toMatch(/21\. a 22\. listopadu 2025/);
    });

    it("handles two days in different months", () => {
      const range = ["2025-11-30", "2025-12-01"];
      expect(formatDateRange(range)).toBe("30. listopadu 2025 a 1. prosince 2025");
    });

    it("handles >2 days in same month (range)", () => {
      const range = ["2025-11-21", "2025-11-22", "2025-11-23"];
      // Should be "21.—23. listopadu 2025"
      // Note: Check the dash used in implementation (em dash or en dash?)
      // Implementation uses '—' (em dash) in one case and '—' in another?
      // Let's check the code: it uses "—" (em dash) in line 66 and 70.
      expect(formatDateRange(range)).toBe("21.—23. listopadu 2025");
    });

    it("handles >2 days crossing months", () => {
      const range = ["2025-11-29", "2025-11-30", "2025-12-01"];
      expect(formatDateRange(range)).toBe("29. listopadu 2025 — 1. prosince 2025");
    });

    it("handles >2 days crossing years", () => {
      const range = ["2025-12-30", "2025-12-31", "2026-01-01"];
      expect(formatDateRange(range)).toBe("30. prosince 2025 — 1. ledna 2026");
    });

    it("sorts dates correctly before formatting", () => {
      const range = ["2025-11-23", "2025-11-21", "2025-11-22"];
      expect(formatDateRange(range)).toBe("21.—23. listopadu 2025");
    });
  });
});
