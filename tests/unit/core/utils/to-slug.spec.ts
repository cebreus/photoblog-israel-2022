import { describe, expect, it } from "vitest";
import { toSlug } from "$shared/utils/strings";

describe("shared/utils/strings.ts - toSlug", () => {
  it("should format normal strings correctly", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
    expect(toSlug("Image_123.jpg")).toBe("image123jpg");
  });

  it("should preserve double-hyphen for any suffix", () => {
    // Collage
    expect(toSlug("image--collage")).toBe("image--collage");
    expect(toSlug("DSC_1234--collage")).toBe("dsc1234--collage");

    // Zoom
    expect(toSlug("photo--zoom2x3")).toBe("photo--zoom2x3");
    expect(toSlug("IMG_5678--zoom1x2")).toBe("img5678--zoom1x2");

    // Panorama
    expect(toSlug("landscape--panorama")).toBe("landscape--panorama");

    // Any custom suffix
    expect(toSlug("test--custom")).toBe("test--custom");
  });

  it("should not affect other multiple hyphens", () => {
    // Double hyphens in the middle should be collapsed
    expect(toSlug("some--other-name")).toBe("some-other-name");

    // If there's a double-hyphen at the end, it's preserved
    expect(toSlug("multi--hyphen--test")).toBe("multi-hyphen--test");

    // Only preserve double-hyphen at the END
    expect(toSlug("prefix--middle-end")).toBe("prefix-middle-end");
  });

  it("should handle edge cases", () => {
    expect(toSlug("")).toBe("");
    // slugify converts "--suffix" to "suffix", then we restore it
    expect(toSlug("--suffix")).toBe("suffix--suffix");
    expect(toSlug("name--")).toBe("name");
  });
});
