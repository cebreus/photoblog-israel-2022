import { describe, expect, it } from "vitest";
import {
  clapRationalToPixels,
  parseClapString,
  pixelsToClapString,
} from "../../../../scripts/lib/image/clap-parser";
import { nativeClapToUserCrop, userCropToNativeClap } from "$shared/utils/clap-transform";

describe("clap-parser", () => {
  describe("parseClapString", () => {
    it("parses valid clap string", () => {
      expect(parseClapString("4032 1 3016 1 0 1 2 1")).toEqual({
        widthN: 4032,
        widthD: 1,
        heightN: 3016,
        heightD: 1,
        horizOffN: 0,
        horizOffD: 1,
        vertOffN: 2,
        vertOffD: 1,
      });
    });

    it("returns null for invalid input", () => {
      expect(parseClapString("invalid")).toBeNull();
      expect(parseClapString("1 2 3")).toBeNull();
    });

    it("handles fractional values", () => {
      expect(parseClapString("4000 10 3000 10 5 2 -5 2")).toEqual({
        widthN: 4000,
        widthD: 10,
        heightN: 3000,
        heightD: 10,
        horizOffN: 5,
        horizOffD: 2,
        vertOffN: -5,
        vertOffD: 2,
      });
    });
  });

  describe("clapRationalToPixels", () => {
    it("converts rational to float pixels", () => {
      const result = clapRationalToPixels({
        widthN: 4000,
        widthD: 10,
        heightN: 3000,
        heightD: 10,
        horizOffN: 5,
        horizOffD: 2,
        vertOffN: -10,
        vertOffD: 2,
      });

      expect(result).toEqual({
        width: 400,
        height: 300,
        horizOffset: 2.5,
        vertOffset: -5,
      });
    });
  });

  describe("pixelsToClapString", () => {
    it("formats integers correctly", () => {
      const clap = { width: 100, height: 200, horizOffset: 0, vertOffset: 10 };
      expect(pixelsToClapString(clap)).toBe("100 1 200 1 0 1 10 1");
    });

    it("formats floats correctly", () => {
      const clap = { width: 100.5, height: 200.1, horizOffset: 0.5, vertOffset: -10.2 };
      expect(pixelsToClapString(clap)).toBe("1005 10 2001 10 5 10 -102 10");
    });
  });
});

describe("clap-transform", () => {
  const NATIVE = { w: 4000, h: 3000 };

  describe("userCropToNativeClap", () => {
    it("handles Orientation 1 (Normal)", () => {
      // Center crop 50% size
      const user = { x: 25, y: 25, width: 50, height: 50 };
      const clap = userCropToNativeClap(user, NATIVE.w, NATIVE.h, 1);

      expect(clap.width).toBe(2000);
      expect(clap.height).toBe(1500);
      expect(clap.horizOffset).toBe(0);
      expect(clap.vertOffset).toBe(0);
    });

    it("handles Orientation 6 (90 CW)", () => {
      // User sees portrait image. Crop top 50%.
      // User Space: 0,0 is Top-Left visually.
      // Native Space: Rotated 90 CW. Native (0,0) is visually Top-Right.
      // User crop: x:0, y:0, w:100, h:50.

      const user = { x: 0, y: 0, width: 100, height: 50 };
      const clap = userCropToNativeClap(user, NATIVE.w, NATIVE.h, 6);

      // Expected Native:
      // Width (should match user height): 50% of 3000 (native H, visual W) -> 1500?
      // Wait. Native W=4000, H=3000.
      // Rotated 6: Visual W=3000, H=4000.
      // User crop 100% width -> 3000px visual width -> native height 3000px.
      // User crop 50% height -> 2000px visual height -> native width 2000px.
      // Native Crop dimensions: W=2000, H=3000.

      expect(clap.width).toBe(2000); // Native X axis is Visual Y axis (down)
      expect(clap.height).toBe(3000); // Native Y axis is Visual X axis (left)

      // Offset calculation:
      // Native Center is (2000, 1500).
      // Crop is the "top half" visually.
      // Visual Top is Native Right (high X).
      // So native crop center should have X > 2000.
      // Center of crop in Native X: Range [2000...4000] -> Center 3000.
      // Offset X = 3000 - 2000 = +1000.

      expect(clap.horizOffset).toBe(-1000);
      expect(clap.vertOffset).toBe(0);
    });
  });

  describe("nativeClapToUserCrop via Roundtrip", () => {
    it("roundtrips correctly for Orientation 1", () => {
      const user = { x: 10, y: 20, width: 50, height: 60 };
      const clap = userCropToNativeClap(user, NATIVE.w, NATIVE.h, 1);
      const rUser = nativeClapToUserCrop(clap, NATIVE.w, NATIVE.h, 1);

      expect(rUser.x).toBeCloseTo(user.x);
      expect(rUser.y).toBeCloseTo(user.y);
      expect(rUser.width).toBeCloseTo(user.width);
      expect(rUser.height).toBeCloseTo(user.height);
    });

    it("roundtrips correctly for Orientation 6", () => {
      const user = { x: 10, y: 20, width: 50, height: 60 };
      const clap = userCropToNativeClap(user, NATIVE.w, NATIVE.h, 6);
      const rUser = nativeClapToUserCrop(clap, NATIVE.w, NATIVE.h, 6);

      expect(rUser.x).toBeCloseTo(user.x);
      expect(rUser.y).toBeCloseTo(user.y);
      expect(rUser.width).toBeCloseTo(user.width);
      expect(rUser.height).toBeCloseTo(user.height);
    });
  });
});
