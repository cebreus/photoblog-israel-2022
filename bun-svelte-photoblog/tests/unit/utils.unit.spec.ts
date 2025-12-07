import { describe, it, expect } from "vitest";
import { pluralizeCzech, pluralizeCount } from "../../src/lib/utils";

describe("pluralizeCzech and pluralizeCount", () => {
  it("pluralizes fotka correctly", () => {
    expect(pluralizeCzech(1, ["fotka", "fotky", "fotek"]).trim()).toBe("fotka");
    expect(pluralizeCzech(2, ["fotka", "fotky", "fotek"]).trim()).toBe("fotky");
    expect(pluralizeCzech(5, ["fotka", "fotky", "fotek"]).trim()).toBe("fotek");
  });

  it("pluralizeCount emits count + noun", () => {
    expect(pluralizeCount(1, ["den", "dny", "dní"]).trim()).toBe("1 den");
    expect(pluralizeCount(3, ["den", "dny", "dní"]).trim()).toBe("3 dny");
    expect(pluralizeCount(10, ["den", "dny", "dní"]).trim()).toBe("10 dní");
  });
});
