import { describe, it, expect } from "vitest";
import { parseBooleanParam } from "../../src/lib/stores/urlSync";

describe("parseBooleanParam", () => {
  it("parses truthy values only from 'true'", () => {
    expect(parseBooleanParam("1")).toBe(undefined);
    expect(parseBooleanParam("true")).toBe(true);
    expect(parseBooleanParam("TRUE")).toBe(true);
    expect(parseBooleanParam("  true  ")).toBe(true);
  });

  it("parses falsy values only from 'false'", () => {
    expect(parseBooleanParam("0")).toBe(undefined);
    expect(parseBooleanParam("false")).toBe(false);
    expect(parseBooleanParam("FALSE")).toBe(false);
    expect(parseBooleanParam("  false  ")).toBe(false);
  });

  it("returns undefined for unknown or null", () => {
    expect(parseBooleanParam("")).toBe(undefined);
    expect(parseBooleanParam(null)).toBe(undefined);
    expect(parseBooleanParam("yes")).toBe(undefined);
  });
});
