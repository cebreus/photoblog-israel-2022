/**
 * CLI argument parsing with map-based approach for better maintainability.
 */

import path from "node:path";
import os from "node:os";
import type { Quality, VariantType } from "../../src/lib/types/images";
import { ImageFormat, ImageVariant } from "../../src/lib/types/images";
import type { QualityTypes } from "../../src/lib/types/manifest";
import { config } from "../config";

type QualityFormat = Extract<ImageFormat, "avif" | "webp" | "jpeg">;
type BlurFormat = Extract<ImageFormat, "png" | "avif" | "jpeg">;
type BlurFormats = Array<BlurFormat>;

export type CliOptions = {
  // Main pipeline
  src: string;
  out: string;
  manifest: string;
  manifestOnly: boolean;
  cache?: string;
  variants: VariantType[];
  formats: Array<QualityFormat>;
  quality: Quality;
  allowUpscale: boolean;
  keepOriginal: boolean;
  concurrency: number | "auto";
  watch: boolean;
  clean: boolean;
  fallback: "none" | "copy";
  verbose: boolean;
  quiet: boolean;
  lqipWidth: number;
  limit: number;

  // Blur assets
  blurEnable: boolean;
  blurOnly: boolean;
  blurSrc: string;
  blurOut: string;
  blurWidth: number;
  blurColors: number;
  blurFormats: BlurFormats;
  blurPngCompression: number;
  blurPngQuality: number;
  blurAvifQuality: number;
  blurJpegQuality: number;
  blurClean: boolean;
  curation: boolean;
};

const QUALITY_FORMATS: readonly QualityFormat[] = [
  ImageFormat.AVIF,
  ImageFormat.WEBP,
  ImageFormat.JPEG,
];

const BLUR_FORMATS: readonly BlurFormat[] = [ImageFormat.PNG, ImageFormat.AVIF, ImageFormat.JPEG];

const VARIANT_TYPES: readonly string[] = [
  ImageVariant.DETAILS,
  ImageVariant.PREVIEWS,
  ImageVariant.PREVIEWS_XL,
  ImageVariant.PREVIEWS_XXS,
];

function isQualityType(x: string): x is QualityFormat {
  return QUALITY_FORMATS.some(function equals(v) {
    return v === x;
  });
}

function isBlurFormat(x: string): x is BlurFormat {
  return BLUR_FORMATS.some(function equals(v) {
    return v === x;
  });
}

function isVariantType(x: string): x is VariantType {
  return VARIANT_TYPES.includes(x);
}

function parseQualityTypes(input: string): QualityTypes[] {
  return input.split(",").map(trimLower).filter(isQualityType);
}

function parseBlurFormats(input: string): BlurFormats {
  return input.split(",").map(trimLower).filter(isBlurFormat);
}

function parseVariantTypes(input: string): VariantType[] {
  return input.split(",").map(trimVariant).filter(isVariantType);
}

function trimLower(s: string): string {
  return s.trim().toLowerCase();
}

function trimVariant(s: string): string {
  return s.trim();
}

export const DEFAULT_CLI_OPTIONS: CliOptions = {
  src: "",
  out: "",
  manifest: "",
  manifestOnly: false,
  variants: [
    ImageVariant.DETAILS,
    ImageVariant.PREVIEWS,
    ImageVariant.PREVIEWS_XL,
    ImageVariant.PREVIEWS_XXS,
  ],
  formats: [...config.encoding.formats],
  quality: { ...config.encoding.quality },
  allowUpscale: false,
  keepOriginal: false,
  concurrency: config.script.concurrency,
  watch: false,
  clean: false,
  fallback: "none",
  verbose: false,
  quiet: false,
  lqipWidth: config.outputs.placeholder.resize.width,
  limit: config.script.limit,

  blurEnable: config.blur.enable,
  blurOnly: config.blur.only,
  blurSrc: config.blur.src,
  blurOut: config.blur.out,
  blurWidth: config.blur.width,
  blurColors: config.blur.colors,
  blurFormats: [...config.blur.formats],
  blurPngCompression: config.blur.pngCompression,
  blurPngQuality: config.blur.pngQuality,
  blurAvifQuality: config.blur.avifQuality,
  blurJpegQuality: config.blur.jpegQuality,
  blurClean: config.blur.clean,
  curation: false,
};

type ArgHandler = (value: string, args: CliOptions) => void;

const CLI_FLAG_HANDLERS: Record<string, ArgHandler> = {
  src: function handleSrc(v, a) {
    a.src = path.resolve(process.cwd(), v);
  },
  out: function handleOut(v, a) {
    a.out = path.resolve(process.cwd(), v);
  },
  manifest: function handleManifest(v, a) {
    a.manifest = path.resolve(process.cwd(), v);
  },
  "manifest-only": function handleManifestOnly(v, a) {
    a.manifestOnly = v === "true";
  },
  manifestOnly: function handleManifestOnlyAlias(v, a) {
    a.manifestOnly = v === "true";
  },
  cache: function handleCache(v, a) {
    a.cache = path.resolve(process.cwd(), v);
  },
  variants: function handleVariants(v, a) {
    a.variants = parseVariantTypes(v);
  },
  formats: function handleFormats(v, a) {
    a.formats = parseQualityTypes(v);
  },
  "quality.avif": function handleQualityAvif(v, a) {
    const quality = parseInt(v, 10);
    if (!Number.isNaN(quality)) {
      a.quality.avif = Math.max(1, Math.min(100, quality));
    }
  },
  "quality.webp": function handleQualityWebp(v, a) {
    const quality = parseInt(v, 10);
    if (!Number.isNaN(quality)) {
      a.quality.webp = Math.max(1, Math.min(100, quality));
    }
  },
  "quality.jpeg": function handleQualityJpeg(v, a) {
    const quality = parseInt(v, 10);
    if (!Number.isNaN(quality)) {
      a.quality.jpeg = Math.max(1, Math.min(100, quality));
    }
  },
  "allow-upscale": function handleAllowUpscale(v, a) {
    a.allowUpscale = v === "true";
  },
  "keep-original": function handleKeepOriginal(v, a) {
    a.keepOriginal = v === "true";
  },
  concurrency: function handleConcurrency(v, a) {
    if (v === "auto") {
      a.concurrency = "auto";
    } else {
      const num = parseInt(v, 10);
      if (!Number.isNaN(num)) {
        a.concurrency = Math.max(1, num);
      }
    }
  },
  watch: function handleWatch(v, a) {
    a.watch = v === "true";
  },
  clean: function handleClean(v, a) {
    a.clean = v === "true";
  },
  fallback: function handleFallback(v, a) {
    a.fallback = v === "copy" ? "copy" : "none";
  },
  verbose: function handleVerbose(v, a) {
    a.verbose = v === "true";
  },
  quiet: function handleQuiet(v, a) {
    a.quiet = v === "true";
  },
  lqipWidth: function handleLqipWidth(v, a) {
    const width = parseInt(v, 10);
    if (!Number.isNaN(width)) {
      a.lqipWidth = Math.max(1, width);
    }
  },
  limit: function handleLimit(v, a) {
    const limit = parseInt(v, 10);
    if (!Number.isNaN(limit)) {
      a.limit = Math.max(0, limit);
    }
  },

  // Blur group
  "blur.enable": function handleBlurEnable(v, a) {
    a.blurEnable = v === "true";
  },
  "blur.only": function handleBlurOnly(v, a) {
    a.blurOnly = v === "true";
  },
  "blur.src": function handleBlurSrc(v, a) {
    a.blurSrc = path.resolve(process.cwd(), v);
  },
  "blur.out": function handleBlurOut(v, a) {
    a.blurOut = path.resolve(process.cwd(), v);
  },
  "blur.width": function handleBlurWidth(v, a) {
    const width = parseInt(v, 10);
    if (!Number.isNaN(width)) {
      a.blurWidth = Math.max(1, width);
    }
  },
  "blur.colors": function handleBlurColors(v, a) {
    const colors = parseInt(v, 10);
    if (!Number.isNaN(colors)) {
      a.blurColors = Math.max(2, Math.min(256, colors));
    }
  },
  "blur.formats": function handleBlurFormats(v, a) {
    a.blurFormats = parseBlurFormats(v);
  },
  "blur.pngCompression": function handleBlurPngCompression(v, a) {
    const compression = parseInt(v, 10);
    if (!Number.isNaN(compression)) {
      a.blurPngCompression = Math.max(0, Math.min(9, compression));
    }
  },
  "blur.pngQuality": function handleBlurPngQuality(v, a) {
    const quality = parseInt(v, 10);
    if (!Number.isNaN(quality)) {
      a.blurPngQuality = Math.max(0, Math.min(100, quality));
    }
  },
  "blur.avifQuality": function handleBlurAvifQuality(v, a) {
    const quality = parseInt(v, 10);
    if (!Number.isNaN(quality)) {
      a.blurAvifQuality = Math.max(1, Math.min(100, quality));
    }
  },
  "blur.jpegQuality": function handleBlurJpegQuality(v, a) {
    const quality = parseInt(v, 10);
    if (!Number.isNaN(quality)) {
      a.blurJpegQuality = Math.max(1, Math.min(100, quality));
    }
  },
  "blur.clean": function handleBlurClean(v, a) {
    a.blurClean = v === "true";
  },
  curation: function handleCuration(v, a) {
    a.curation = v === "true";
  },
};

export function parseCliArguments(argv: string[]): CliOptions {
  // Use structuredClone to avoid mutating the global DEFAULT_CLI_OPTIONS
  // when modifying nested properties like 'quality'.
  const out: CliOptions = structuredClone(DEFAULT_CLI_OPTIONS);

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [k, vRaw] = arg.slice(2).split("=");
    const v = vRaw ?? "true";

    const handler = CLI_FLAG_HANDLERS[k];
    if (handler) {
      handler(v, out);
    }
    // Unknown flags are silently ignored
  }

  // Post-processing
  if (out.concurrency === "auto") {
    out.concurrency = Math.max(1, (os.cpus()?.length || 2) - 1);
  }

  return out;
}
