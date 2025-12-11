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

describe("URL parameter behavior", () => {
  it("parseBooleanParam returns undefined for '1' and '0'", () => {
    // Ensure backward compat values are NOT accepted
    expect(parseBooleanParam("1")).toBe(undefined);
    expect(parseBooleanParam("0")).toBe(undefined);
  });

  it("parseBooleanParam accepts case-insensitive true/false", () => {
    expect(parseBooleanParam("True")).toBe(true);
    expect(parseBooleanParam("False")).toBe(false);
    expect(parseBooleanParam("TrUe")).toBe(true);
    expect(parseBooleanParam("fAlSe")).toBe(false);
  });

  it("parseBooleanParam trims whitespace", () => {
    expect(parseBooleanParam("  true  ")).toBe(true);
    expect(parseBooleanParam("\tfalse\n")).toBe(false);
  });

  it("parseBooleanParam rejects other truthy/falsy strings", () => {
    expect(parseBooleanParam("yes")).toBe(undefined);
    expect(parseBooleanParam("no")).toBe(undefined);
    expect(parseBooleanParam("on")).toBe(undefined);
    expect(parseBooleanParam("off")).toBe(undefined);
  });
});
