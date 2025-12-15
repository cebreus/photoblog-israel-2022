/**
 * Central configuration for the image generation script.
 * Defines paths, image variants, quality settings, and other parameters.
 */

import { ImageFormat } from "../src/lib/types/images";
import path from "node:path";

const IMAGE_SUBDIR = "pics";

const contentDir = process.env.CONTENT_DIR || "israel-2022";
console.log(`Using content directory: ${contentDir}`);

export const config = {
  paths: {
    source: `content/${contentDir}/${IMAGE_SUBDIR}`,
    siteSource: `content/${contentDir}`,
    output: `static/${contentDir}/images`,
    urlPrefix: `/${contentDir}`,
    dataRoot: `src/lib/data/${contentDir}`,
    manifest: `src/lib/data/${contentDir}/images.manifest.json`,
    siteManifest: `src/lib/data/${contentDir}/site.manifest.json`,
    cache: `.temp/${contentDir}/images.cache.json`,
    tmp: ".temp",
  },

  /**
   * Unified outputs configuration.
   * Each entry declares its kind (variant/other) and associated settings.
   */
  outputs: {
    default: {
      kind: "variant",
      media: "(max-width: 575px), (min-width: 1400px)",
      resize: { width: 370, height: 208, crop: true },
      folderName: "previews",
    },
    xl: {
      kind: "variant",
      media: "(min-width: 576px) and (max-width: 1399px)",
      resize: { width: 534, height: 300, crop: true },
      folderName: "previews-xl",
    },
    detail: {
      kind: "other",
      resize: { width: 1280 },
      format: ImageFormat.JPEG,
      folderName: "details",
    },
    fallback: {
      kind: "other",
      resize: { width: 190, height: 107, crop: true },
      folderName: "previews-xxs",
    },
    placeholder: {
      kind: "other",
      resize: { width: 24 },
      blur: true,
      format: ImageFormat.PNG,
      folderName: "blurs",
      isPlaceholder: true,
    },
  },

  encoding: {
    formats: [ImageFormat.WEBP, ImageFormat.JPEG, ImageFormat.AVIF],
    quality: {
      [ImageFormat.JPEG]: 80,
      [ImageFormat.WEBP]: 65,
      [ImageFormat.AVIF]: 50,
    },
    /** Sharp.js optimization parameters */
    sharp: {
      jpeg: {
        progressive: true,
        mozjpeg: false,
        chromaSubsampling: "4:2:0",
      },
      webp: {
        effort: 4,
      },
      avif: {
        effort: 5,
        chromaSubsampling: "4:2:0",
      },
      blur: {
        png: {
          palette: true,
          colors: 32,
          quality: 50,
          compressionLevel: 9,
        },
      },
    },
  },

  script: {
    concurrency: "auto" as const,
    limit: 0,
    inputExtensions: [
      "jpg",
      ImageFormat.JPEG,
      ImageFormat.PNG,
      ImageFormat.WEBP,
      ImageFormat.AVIF,
      "heic",
      "HEIC",
    ],
  },

  blur: {
    enable: false,
    only: false,
    src: path.resolve(
      process.cwd(),
      "../static/assets/israel-2022/previews-xl",
    ),
    out: path.resolve(process.cwd(), "../static/assets/israel-2022/blurs"),
    width: 24,
    colors: 32,
    formats: [ImageFormat.PNG],
    pngCompression: 9,
    pngQuality: 50,
    avifQuality: 50,
    jpegQuality: 40,
    clean: false,
  },
} as const;
