import { ImageFormat } from "../src/lib/types/images";

const IMAGE_SUBDIR = "pics";

const contentDir = process.env.CONTENT_DIR || "egypt-2025";

export const config = {
  paths: {
    source: `content/${contentDir}/${IMAGE_SUBDIR}`,
    siteSource: `content/${contentDir}`,
    output: `static/${contentDir}/images`,
    facesRoot: `static/${contentDir}/faces`,
    urlPrefix: `/${contentDir}`,
    dataRoot: `src/data/${contentDir}`,
    manifest: `src/data/${contentDir}/images.manifest.json`,
    siteManifest: `src/data/${contentDir}/site.manifest.json`,
    cache: `.temp/${contentDir}/images.cache.json`,
    tmp: ".temp",
  },
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
    admin_thumb: {
      kind: "other",
      resize: { width: 534, height: 534, crop: false, fit: "inside" },
      folderName: "admin-thumbs",
    },
    // Panorama-specific: height-limited, full width preserved
    pano_detail: {
      kind: "other",
      resize: { height: 1280, crop: false, fit: "inside" },
      format: ImageFormat.JPEG,
      folderName: "details-pano",
    },
  },

  encoding: {
    formats: [ImageFormat.WEBP, ImageFormat.JPEG, ImageFormat.AVIF],
    quality: {
      [ImageFormat.JPEG]: 80,
      [ImageFormat.WEBP]: 65,
      [ImageFormat.AVIF]: 50,
    },
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
    concurrency: "auto" as number | "auto",
    limit: 0,
    inputExtensions: [
      "jpg",
      ImageFormat.JPEG,
      ImageFormat.PNG,
      ImageFormat.WEBP,
      ImageFormat.AVIF,
      "heic",
    ],
    cropFaceCenterRatio: 0.4,
    cropFaceZoom: 1.4, // 1.0 = Max area, > 1.0 = Zoomed in on faces
  },

  /**
   * Separator & Menu Configuration
   *
   * Separators are visual dividers in the photo grid that group photos by location.
   * They can be created automatically (from EXIF location data) or manually (from markdown).
   */
  separator: {
    /**
     * Minimum number of photos required to auto-generate a separator for a location.
     * Locations with fewer photos will NOT get an automatic separator.
     * Set to 3 to avoid cluttering the UI with single-photo locations.
     *
     * NOTE: Markdown-defined separators are ALWAYS created regardless of photo count.
     * This threshold only affects AUTO-GENERATED separators.
     */
    minPhotosForAutoSeparator: 3,

    /**
     * Minimum number of photos required for a separator to be DISPLAYED in the photo grid.
     * Separators with fewer photos are hidden (orphan separators).
     *
     * This applies to BOTH markdown-defined and auto-generated separators.
     * A separator may exist in the manifest but not be rendered if it has too few photos.
     */
    minPhotosForDisplay: 3,
  },

  blur: {
    enable: false,
    only: false,
    src: `static/${contentDir}/images/previews-xl`,
    out: `static/${contentDir}/images/blurs`,
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
