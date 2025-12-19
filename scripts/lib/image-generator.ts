import path from "node:path";
import type { Sharp } from "sharp";
import { ImageFormat } from "../../src/lib/types/images";
import type { QualityTypes } from "../../src/lib/types/manifest";
import { config } from "../config";
import type { FaceBox } from "./face-detection";
import type { ImageProcessOptions } from "./image-processor";
import { ensureDir } from "./image-utils";
import { calculateSmartCrop } from "./smart-crop";

type SharpModule = typeof import("sharp");
type OutputConfig = (typeof config.outputs)[keyof typeof config.outputs];
export type VariantOutputConfig = Extract<OutputConfig, { kind: "variant" }>;
export type OtherOutputConfig = Extract<OutputConfig, { kind: "other" }>;

interface ResizeConfig {
  width?: number;
  height?: number;
  crop?: boolean;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

function getQuality(
  format: ImageFormat,
  qualityOverrides: Partial<Record<QualityTypes, number>>,
): number {
  const qualityKey = format === ImageFormat.PNG ? ImageFormat.JPEG : format;
  return qualityOverrides[qualityKey] ?? config.encoding.quality[qualityKey];
}

function jpegStrategy(instance: Sharp, quality: number): void {
  instance.jpeg({ quality, ...config.encoding.sharp.jpeg });
}

function webpStrategy(instance: Sharp, quality: number): void {
  instance.webp({ quality, ...config.encoding.sharp.webp });
}

function avifStrategy(instance: Sharp, quality: number): void {
  instance.avif({ quality, ...config.encoding.sharp.avif });
}

type FormatStrategy = (instance: Sharp, quality: number) => void;

const FORMAT_STRATEGIES: Record<string, FormatStrategy> = {
  [ImageFormat.JPEG]: jpegStrategy,
  [ImageFormat.WEBP]: webpStrategy,
  [ImageFormat.AVIF]: avifStrategy,
};

function applyFormat(instance: Sharp, format: ImageFormat, quality: number): void {
  const strategy = FORMAT_STRATEGIES[format];
  if (strategy) {
    strategy(instance, quality);
  }
}

function buildSharpInstance(
  sharpModule: SharpModule,
  input: Buffer | string,
  resizeConfig: ResizeConfig,
  allowUpscale: boolean,
) {
  const resizeSpec: import("sharp").ResizeOptions = { ...resizeConfig };
  if (resizeConfig.crop) {
    resizeSpec.fit = "cover";
  }
  if (!allowUpscale) {
    resizeSpec.withoutEnlargement = true;
  }
  return sharpModule(input).resize(resizeSpec);
}

function calculateOutputDimensions(
  srcW: number,
  srcH: number,
  resize: ResizeConfig,
  allowUpscale: boolean,
): { width: number; height: number } {
  if (!srcW || !srcH) return { width: 0, height: 0 };

  let targetW = resize.width;
  let targetH = resize.height;
  const fit = resize.crop ? "cover" : resize.fit || "cover";

  if (!targetW && !targetH) return { width: srcW, height: srcH };

  if (!targetH && targetW) {
    targetH = Math.round(srcH * (targetW / srcW));
  } else if (!targetW && targetH) {
    targetW = Math.round(srcW * (targetH / srcH));
  }

  if (!targetW) targetW = srcW;
  if (!targetH) targetH = srcH;

  if (!allowUpscale) {
    if (targetW > srcW || targetH > srcH) {
      if (fit === "inside" || fit === "contain") {
        const scale = Math.min(1, Math.min(targetW / srcW, targetH / srcH));
        targetW = Math.round(srcW * scale);
        targetH = Math.round(srcH * scale);
      } else if (fit === "cover" || fit === "fill") {
        if (targetW > srcW && targetH > srcH) {
          targetW = srcW;
          targetH = srcH;
        }
      }
    }
  }

  return { width: targetW, height: targetH };
}

export async function generateVariant(
  sharpModule: SharpModule,
  input: Buffer | string,
  baseName: string,
  variantConfig: VariantOutputConfig,
  format: ImageFormat,
  options: ImageProcessOptions,
  originalMeta: import("sharp").Metadata,
  faces: FaceBox[] = [],
  variantKey?: string,
) {
  const outExt = format === "jpeg" ? "jpeg" : format;
  const variantFolder =
    format === ImageFormat.JPEG
      ? variantConfig.folderName
      : `${variantConfig.folderName}-${format}`;
  const outPath = path.posix.normalize(path.join(variantFolder, `${baseName}.${outExt}`));

  let info: import("sharp").OutputInfo;

  if (options.manifestOnly) {
    const dims = calculateOutputDimensions(
      originalMeta.width ?? 0,
      originalMeta.height ?? 0,
      variantConfig.resize || {},
      options.allowUpscale,
    );
    info = {
      format: format,
      size: 0,
      width: dims.width,
      height: dims.height,
      channels: 3,
      premultiplied: false,
    };
  } else {
    const allowSmartCrop =
      faces.length > 0 &&
      variantConfig.resize?.crop &&
      ["default", "xl", "fallback"].includes(variantKey || "");

    let cropRect = null;
    if (allowSmartCrop) {
      cropRect = calculateSmartCrop(
        originalMeta.width ?? 0,
        originalMeta.height ?? 0,
        faces,
        variantConfig.resize?.width ?? 0,
        variantConfig.resize?.height ?? 0,
      );
    }

    let resizedInstance: Sharp;

    if (cropRect) {
      resizedInstance = sharpModule(input)
        .extract({
          left: Math.round(cropRect.left),
          top: Math.round(cropRect.top),
          width: Math.round(cropRect.width),
          height: Math.round(cropRect.height),
        })
        .resize({
          width: variantConfig.resize?.width,
          height: variantConfig.resize?.height,
        });
    } else {
      resizedInstance = buildSharpInstance(
        sharpModule,
        input,
        variantConfig.resize,
        options.allowUpscale,
      );
    }

    const quality = getQuality(format, options.qualityOverrides);
    applyFormat(resizedInstance, format, quality);

    const fullOutPath = path.join(options.outRoot, outPath);
    await ensureDir(path.dirname(fullOutPath));
    info = await resizedInstance.toFile(fullOutPath);
  }

  return { outPath, info };
}

export async function generateOtherOutput(
  sharpModule: SharpModule,
  input: Buffer | string,
  baseName: string,
  outputConfig: OtherOutputConfig,
  options: ImageProcessOptions,
  originalMeta: import("sharp").Metadata,
) {
  const format = "format" in outputConfig ? outputConfig.format : ImageFormat.JPEG;
  const outExt = format === "jpeg" ? "jpeg" : format;
  const outPath = path.posix.normalize(path.join(outputConfig.folderName, `${baseName}.${outExt}`));

  let info: import("sharp").OutputInfo;

  if (options.manifestOnly) {
    const dims = calculateOutputDimensions(
      originalMeta.width ?? 0,
      originalMeta.height ?? 0,
      outputConfig.resize || {},
      options.allowUpscale,
    );
    info = {
      format: format,
      size: 0,
      width: dims.width,
      height: dims.height,
      channels: 3,
      premultiplied: false,
    };
  } else {
    const resizedInstance = buildSharpInstance(
      sharpModule,
      input,
      outputConfig.resize || {},
      options.allowUpscale,
    );

    if ("blur" in outputConfig && outputConfig.blur) {
      resizedInstance.blur(10).png(config.encoding.sharp.blur.png);
    } else {
      const quality = getQuality(format, options.qualityOverrides);
      applyFormat(resizedInstance, format, quality);
    }

    const fullOutPath = path.join(options.outRoot, outPath);
    await ensureDir(path.dirname(fullOutPath));
    info = await resizedInstance.toFile(fullOutPath);
  }

  return { outPath, info };
}
