import { describe, it, expect } from "vitest";
import { toSlug } from "../../src/lib/utils/strings";

describe("toSlug", () => {
  it("slugifies simple names", () => {
    expect(toSlug("Cebreus")).toBe("cebreus");
  });

  it("removes unsafe chars and lowercases", () => {
    expect(toSlug("Jan Novák")).toBe("jan-novak");
    expect(toSlug("Těžký / jméno?!!")).toBe("tezky-jmeno");
  });
});
