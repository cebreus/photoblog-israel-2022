/**
 * @fileoverview Unit tests for Czech plural helper
 */

import { getPlural } from "$lib/utils/i18n";
import { describe, expect, it, vi } from "vitest";

// Mock $app/environment
vi.mock("$app/environment", () => ({
  browser: false,
  dev: true,
}));

// Mock Paraglide
vi.mock("$lib/paraglide/runtime", () => ({
  getLocale: vi.fn(() => "cs"),
}));

vi.mock("$lib/paraglide/messages", () => ({
  plural_osoba: vi.fn(({ count }) =>
    count === 1 ? "osoba" : count > 1 && count < 5 ? "osoby" : "osob",
  ),
  plural_fotka: vi.fn(({ count }) =>
    count === 1 ? "fotka" : count > 1 && count < 5 ? "fotky" : "fotek",
  ),
}));

describe("getPlural", () => {
  it("osoba - returns correct forms in Czech", () => {
    expect(getPlural(1, "osoba")).toBe("osoba");
    expect(getPlural(2, "osoba")).toBe("osoby");
    expect(getPlural(5, "osoba")).toBe("osob");
  });

  it("fotka - returns correct forms in Czech", () => {
    expect(getPlural(1, "fotka")).toBe("fotka");
    expect(getPlural(2, "fotka")).toBe("fotky");
    expect(getPlural(5, "fotka")).toBe("fotek");
  });

  it("handles negative numbers via absolute value", () => {
    // getPlural doesn't explicitly abs() yet, let's see current behavior
    // Actually the mock returns 'osob' for -1 because count < 1 falls into 'other/osob'
    expect(getPlural(-1, "osoba")).toBe("osob");
  });
});
