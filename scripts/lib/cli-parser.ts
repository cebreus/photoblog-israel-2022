import path from "node:path";
import type { Quality, VariantType } from "../../src/lib/types/images";
import { ImageFormat, ImageVariant } from "../../src/lib/types/images";
import type { QualityTypes } from "../../src/lib/types/manifest";
import { config } from "../config";
import { getConcurrency } from "./concurrency-utils";

type QualityFormat = Extract<ImageFormat, "avif" | "webp" | "jpeg">;
type BlurFormat = Extract<ImageFormat, "png" | "avif" | "jpeg">;
type BlurFormats = Array<BlurFormat>;

export type CliOptions = {
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
  title?: string;
  skipFaces?: boolean;
  skipEmbeddings?: boolean;
  batchSize: number;
  timeWindow: number;
  author?: string;
  threshold: number;
  minConfidence: number;
  minFaceSize: number;
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

function parseIntWithinRange(value: string, min: number, max: number): number | undefined {
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) return undefined;
  return Math.max(min, Math.min(max, num));
}

function parseFloatWithinRange(value: string, min: number, max: number): number | undefined {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return undefined;
  return Math.max(min, Math.min(max, num));
}

function parseBooleanValue(value: string): boolean {
  return value === "true";
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
  batchSize: 8,
  timeWindow: 4 * 60 * 60 * 1000, // 4 hours in ms
  author: "",
  threshold: 0.5,
  minConfidence: 0.5,
  minFaceSize: 0,
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
    const quality = parseIntWithinRange(v, 1, 100);
    if (quality !== undefined) a.quality.avif = quality;
  },
  "quality.webp": function handleQualityWebp(v, a) {
    const quality = parseIntWithinRange(v, 1, 100);
    if (quality !== undefined) a.quality.webp = quality;
  },
  "quality.jpeg": function handleQualityJpeg(v, a) {
    const quality = parseIntWithinRange(v, 1, 100);
    if (quality !== undefined) a.quality.jpeg = quality;
  },
  "allow-upscale": function handleAllowUpscale(v, a) {
    a.allowUpscale = parseBooleanValue(v);
  },
  "keep-original": function handleKeepOriginal(v, a) {
    a.keepOriginal = parseBooleanValue(v);
  },
  concurrency: function handleConcurrency(v, a) {
    if (v === "auto") {
      a.concurrency = "auto";
    } else {
      const num = parseIntWithinRange(v, 1, Number.MAX_SAFE_INTEGER);
      if (num !== undefined) a.concurrency = num;
    }
  },
  watch: function handleWatch(v, a) {
    a.watch = parseBooleanValue(v);
  },
  clean: function handleClean(v, a) {
    a.clean = parseBooleanValue(v);
  },
  fallback: function handleFallback(v, a) {
    a.fallback = v === "copy" ? "copy" : "none";
  },
  verbose: function handleVerbose(v, a) {
    a.verbose = parseBooleanValue(v);
  },
  quiet: function handleQuiet(v, a) {
    a.quiet = parseBooleanValue(v);
  },
  lqipWidth: function handleLqipWidth(v, a) {
    const width = parseIntWithinRange(v, 1, Number.MAX_SAFE_INTEGER);
    if (width !== undefined) a.lqipWidth = width;
  },
  limit: function handleLimit(v, a) {
    const limit = parseIntWithinRange(v, 0, Number.MAX_SAFE_INTEGER);
    if (limit !== undefined) a.limit = limit;
  },

  "blur.enable": function handleBlurEnable(v, a) {
    a.blurEnable = parseBooleanValue(v);
  },
  "blur.only": function handleBlurOnly(v, a) {
    a.blurOnly = parseBooleanValue(v);
  },
  "blur.src": function handleBlurSrc(v, a) {
    a.blurSrc = path.resolve(process.cwd(), v);
  },
  "blur.out": function handleBlurOut(v, a) {
    a.blurOut = path.resolve(process.cwd(), v);
  },
  "blur.width": function handleBlurWidth(v, a) {
    const width = parseIntWithinRange(v, 1, Number.MAX_SAFE_INTEGER);
    if (width !== undefined) a.blurWidth = width;
  },
  "blur.colors": function handleBlurColors(v, a) {
    const colors = parseIntWithinRange(v, 2, 256);
    if (colors !== undefined) a.blurColors = colors;
  },
  "blur.formats": function handleBlurFormats(v, a) {
    a.blurFormats = parseBlurFormats(v);
  },
  "blur.pngCompression": function handleBlurPngCompression(v, a) {
    const compression = parseIntWithinRange(v, 0, 9);
    if (compression !== undefined) a.blurPngCompression = compression;
  },
  "blur.pngQuality": function handleBlurPngQuality(v, a) {
    const quality = parseIntWithinRange(v, 0, 100);
    if (quality !== undefined) a.blurPngQuality = quality;
  },
  "blur.avifQuality": function handleBlurAvifQuality(v, a) {
    const quality = parseIntWithinRange(v, 1, 100);
    if (quality !== undefined) a.blurAvifQuality = quality;
  },
  "blur.jpegQuality": function handleBlurJpegQuality(v, a) {
    const quality = parseIntWithinRange(v, 1, 100);
    if (quality !== undefined) a.blurJpegQuality = quality;
  },
  "blur.clean": function handleBlurClean(v, a) {
    a.blurClean = parseBooleanValue(v);
  },
  curation: function handleCuration(v, a) {
    a.curation = parseBooleanValue(v);
  },
  title: function handleTitle(v, a) {
    a.title = v;
  },
  skipFaces: function handleSkipFaces(v, a) {
    a.skipFaces = parseBooleanValue(v);
  },
  skipEmbeddings: function handleSkipEmbeddings(v, a) {
    a.skipEmbeddings = parseBooleanValue(v);
  },
  "batch-size": function handleBatchSize(v, a) {
    const size = parseIntWithinRange(v, 1, Number.MAX_SAFE_INTEGER);
    if (size !== undefined) a.batchSize = size;
  },
  batchSize: function handleBatchSizeAlias(v, a) {
    const size = parseIntWithinRange(v, 1, Number.MAX_SAFE_INTEGER);
    if (size !== undefined) a.batchSize = size;
  },
  "time-window": function handleTimeWindow(v, a) {
    const window = parseIntWithinRange(v, 1, Number.MAX_SAFE_INTEGER);
    if (window !== undefined) a.timeWindow = window;
  },
  timeWindow: function handleTimeWindowAlias(v, a) {
    const window = parseIntWithinRange(v, 1, Number.MAX_SAFE_INTEGER);
    if (window !== undefined) a.timeWindow = window;
  },
  author: function handleAuthor(v, a) {
    a.author = v;
  },
  threshold: function handleThreshold(v, a) {
    const val = parseFloatWithinRange(v, 0.1, 1.0);
    if (val !== undefined) a.threshold = val;
  },
  minConfidence: function handleMinConfidence(v, a) {
    const val = parseFloatWithinRange(v, 0.1, 1.0);
    if (val !== undefined) a.minConfidence = val;
  },
  minFaceSize: function handleMinFaceSize(v, a) {
    const val = parseIntWithinRange(v, 0, 1000);
    if (val !== undefined) a.minFaceSize = val;
  },
};

export function parseCliArguments(argv: string[]): CliOptions {
  const out: CliOptions = structuredClone(DEFAULT_CLI_OPTIONS);

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [k, vRaw] = arg.slice(2).split("=");
    const v = vRaw ?? "true";

    const handler = CLI_FLAG_HANDLERS[k];
    if (handler) {
      handler(v, out);
    }
  }

  if (out.concurrency === "auto") {
    out.concurrency = getConcurrency("auto");
  }

  return out;
}
