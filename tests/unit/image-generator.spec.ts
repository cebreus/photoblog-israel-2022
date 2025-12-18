import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateOtherOutput, generateVariant } from "../../scripts/lib/image-generator";
import { ImageFormat } from "../../src/lib/types/images";

// Mock Sharp
const mockToFile = vi.fn();
const mockResize = vi.fn().mockReturnThis();
const mockExtract = vi.fn().mockReturnThis();
const mockJpeg = vi.fn().mockReturnThis();
const mockWebp = vi.fn().mockReturnThis();
const mockAvif = vi.fn().mockReturnThis();
const mockPng = vi.fn().mockReturnThis();
const mockBlur = vi.fn().mockReturnThis();

const mockSharpInstance = {
  resize: mockResize,
  extract: mockExtract,
  jpeg: mockJpeg,
  webp: mockWebp,
  avif: mockAvif,
  png: mockPng,
  blur: mockBlur,
  toFile: mockToFile,
};

const mockSharpModule = vi.fn(() => mockSharpInstance) as any;

// Mock image-utils ensureDir
vi.mock("../../scripts/lib/image-utils", () => ({
  ensureDir: vi.fn(),
}));

// Mock config
vi.mock("../../scripts/config", () => ({
  config: {
    encoding: {
      quality: { jpeg: 80, webp: 75, avif: 70 },
      sharp: {
        jpeg: {},
        webp: {},
        avif: {},
        blur: { png: {} },
      },
    },
    outputs: {},
  },
}));

const mockOptions: any = {
  outRoot: "/out",
  manifestOnly: false,
  allowUpscale: false,
  qualityOverrides: {},
};

describe("image-generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToFile.mockResolvedValue({ width: 100, height: 100 });
  });

  describe("generateVariant", () => {
    it("should generate a resized jpeg variant", async () => {
      const variantConfig: any = {
        kind: "variant",
        folderName: "test-folder",
        resize: { width: 100, height: 100 },
      };

      await generateVariant(
        mockSharpModule,
        "input.jpg",
        "basename",
        variantConfig,
        ImageFormat.JPEG,
        mockOptions,
        { width: 1000, height: 1000 } as any,
      );

      expect(mockSharpInstance.resize).toHaveBeenCalled();
      expect(mockSharpInstance.jpeg).toHaveBeenCalled();
      expect(mockSharpInstance.toFile).toHaveBeenCalledWith("/out/test-folder/basename.jpeg");
    });

    it("should use different folder for webp", async () => {
      const variantConfig: any = {
        kind: "variant",
        folderName: "test-folder",
        resize: { width: 100 },
      };

      await generateVariant(
        mockSharpModule,
        "input.jpg",
        "basename",
        variantConfig,
        ImageFormat.WEBP,
        mockOptions,
        { width: 1000, height: 1000 } as any,
      );

      expect(mockSharpInstance.toFile).toHaveBeenCalledWith("/out/test-folder-webp/basename.webp");
    });
  });

  describe("generateOtherOutput", () => {
    it("should apply blur if configured", async () => {
      const outputConfig: any = {
        kind: "other",
        folderName: "placeholders",
        format: "png",
        blur: true,
        resize: { width: 20 },
      };

      await generateOtherOutput(
        mockSharpModule,
        "input.jpg",
        "basename",
        outputConfig,
        mockOptions,
        { width: 1000, height: 1000 } as any,
      );

      expect(mockSharpInstance.blur).toHaveBeenCalled();
      expect(mockSharpInstance.png).toHaveBeenCalled();
    });
  });
});
