import { describe, expect, it } from "vitest";
import { type Box, calculateSmartCrop } from "../../scripts/lib/smart-crop";

describe("calculateSmartCrop", () => {
  it("should return null if no faces provided", () => {
    const res = calculateSmartCrop(1000, 1000, [], 100, 100);
    expect(res).toBeNull();
  });

  describe("Single Face", () => {
    it("should center a single face", () => {
      // Source 1000x1000
      // Face at 400,400 size 200x200 (Center 500,500)
      // Target 500x500 (AR 1:1)
      const faces: Box[] = [{ x: 400, y: 400, width: 200, height: 200 }];
      const res = calculateSmartCrop(1000, 1000, faces, 500, 500);

      expect(res).not.toBeNull();
      // Crop should be 1000x1000 (Source AR == Target AR, so full cover)
      expect(res!.width).toBe(1000);
      expect(res!.height).toBe(1000);
      expect(res!.left).toBe(0);
      expect(res!.top).toBe(0);
    });

    it("should crop width if source is wider than target", () => {
      // Source 2000x1000 (AR 2:1)
      // Target 100x100 (AR 1:1) -> Crop should be 1000x1000
      // Face at 1500, 400 (Center 1500 + w/2)
      // Face rect: x=1400, y=400, w=200, h=200. Center=1500,500
      const faces: Box[] = [{ x: 1400, y: 400, width: 200, height: 200 }];

      const res = calculateSmartCrop(2000, 1000, faces, 100, 100);

      expect(res).not.toBeNull();
      expect(res!.width).toBe(1000);
      expect(res!.height).toBe(1000); // constrained by source height

      // Center of face is 1500. Crop width 1000.
      // Expected left = 1500 - 500 = 1000.
      expect(res!.left).toBe(1000);
      expect(res!.top).toBe(0);
    });

    it("should clamp at limits", () => {
      // Source 2000x1000
      // Face at 0,0, 100,100. Center 50,50.
      // Target AR 1:1 -> Crop size 1000x1000.
      const faces: Box[] = [{ x: 0, y: 0, width: 100, height: 100 }];

      const res = calculateSmartCrop(2000, 1000, faces, 100, 100);

      // Expected left would be 50 - 500 = -450. clamp to 0.
      expect(res!.left).toBe(0);
      expect(res!.top).toBe(0);
    });
  });

  describe("Multiple Faces", () => {
    it("should center around the bounding box of multiple faces", () => {
      // Source 2000x1000
      // Face 1: x=200, width=100 (Center ~250)
      // Face 2: x=1200, width=100 (Center ~1250)
      // Union Center X = (200 + 1300) / 2 = 750.
      // Target AR 1:1 -> Crop 1000x1000.

      const faces: Box[] = [
        { x: 200, y: 400, width: 100, height: 100 },
        { x: 1200, y: 400, width: 100, height: 100 },
      ];

      const res = calculateSmartCrop(2000, 1000, faces, 100, 100);

      // Expected Crop Center X = 750.
      // Expected Left = 750 - 500 = 250.
      expect(res!.left).toBe(250);
      expect(res!.width).toBe(1000);
    });
  });
});
