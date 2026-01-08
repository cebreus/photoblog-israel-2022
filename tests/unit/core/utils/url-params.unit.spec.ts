/**
 * @fileoverview Unit tests for URL parameter utilities
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({
  dev: true,
  browser: false,
}));

import {
  buildAuthorsParam,
  buildPeopleParam,
  buildQualityParam,
  decodeToken,
  encodeToken,
  parseBooleanParam,
  parsePeopleFromUrl,
  parseQualityFromUrl,
} from "$lib/utils/url-params";

describe("url-params utilities", () => {
  describe("decodeToken / encodeToken", () => {
    it("decodes URL-encoded strings", () => {
      expect(decodeToken("jan%20novak")).toBe("jan novak");
      expect(decodeToken("  trimmed  ")).toBe("trimmed");
    });

    it("encodes special characters", () => {
      expect(encodeToken("jan novak")).toBe("jan%20novak");
      expect(encodeToken("a,b")).toBe("a%2Cb");
    });

    it("round-trips correctly", () => {
      const original = "Český název s diakritikou";
      expect(decodeToken(encodeToken(original))).toBe(original);
    });
  });

  describe("parseBooleanParam", () => {
    it("parses true values", () => {
      expect(parseBooleanParam("true")).toBe(true);
      expect(parseBooleanParam("TRUE")).toBe(true);
      expect(parseBooleanParam("  True  ")).toBe(true);
    });

    it("parses false values", () => {
      expect(parseBooleanParam("false")).toBe(false);
      expect(parseBooleanParam("FALSE")).toBe(false);
    });

    it("returns undefined for invalid values", () => {
      expect(parseBooleanParam("")).toBe(undefined);
      expect(parseBooleanParam(null)).toBe(undefined);
      expect(parseBooleanParam("yes")).toBe(undefined);
      expect(parseBooleanParam("1")).toBe(undefined);
    });
  });

  describe("parseQualityFromUrl", () => {
    it("parses quality CSV", () => {
      const url = new URL("https://example.com/?quality=excellent,good");
      expect(parseQualityFromUrl(url)).toEqual(["excellent", "good"]);
    });

    it("returns undefined when param missing", () => {
      const url = new URL("https://example.com/");
      expect(parseQualityFromUrl(url)).toBe(undefined);
    });

    it("returns empty array for empty value", () => {
      const url = new URL("https://example.com/?quality=");
      expect(parseQualityFromUrl(url)).toEqual([]);
    });
  });

  describe("parsePeopleFromUrl", () => {
    it("parses people CSV", () => {
      const url = new URL("https://example.com/?people=person-1,person-2");
      expect(parsePeopleFromUrl(url)).toEqual(["person-1", "person-2"]);
    });

    it("returns empty array when param missing", () => {
      const url = new URL("https://example.com/");
      expect(parsePeopleFromUrl(url)).toEqual([]);
    });

    it("filters out empty values", () => {
      const url = new URL("https://example.com/?people=a,,b,");
      expect(parsePeopleFromUrl(url)).toEqual(["a", "b"]);
    });
  });

  describe("buildQualityParam", () => {
    it("returns undefined when all buckets selected", () => {
      expect(buildQualityParam(["excellent", "good", "poor", "unrated"])).toBe(undefined);
    });

    it("returns CSV for partial selection", () => {
      expect(buildQualityParam(["excellent", "good"])).toBe("excellent,good");
    });

    it("returns single value", () => {
      expect(buildQualityParam(["excellent"])).toBe("excellent");
    });
  });

  describe("buildPeopleParam", () => {
    it("returns undefined for empty array", () => {
      expect(buildPeopleParam([])).toBe(undefined);
    });

    it("returns encoded CSV", () => {
      expect(buildPeopleParam(["person-1", "person-2"])).toBe("person-1,person-2");
    });

    it("encodes special characters", () => {
      const result = buildPeopleParam(["jan novák"]);
      expect(result).toBe("jan%20nov%C3%A1k");
    });
  });

  describe("buildAuthorsParam", () => {
    const authors = [
      { name: "Jan Novák", slug: "jan-novak", count: 5 },
      { name: "Petr Horák", slug: "petr-horak", count: 3 },
    ];

    it("returns undefined for empty selection", () => {
      expect(buildAuthorsParam([], authors)).toBe(undefined);
    });

    it("returns slugs for known authors", () => {
      expect(buildAuthorsParam(["jan-novak"], authors)).toBe("jan-novak");
    });

    it("handles unknown author token", () => {
      expect(buildAuthorsParam([""], authors)).toBe("unknown");
    });

    it("converts names to slugs for unknown authors", () => {
      expect(buildAuthorsParam(["new-author"], authors)).toBe("new-author");
    });
  });
});
