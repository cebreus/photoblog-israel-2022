import { execSync } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { createLogger } from "./logger";

const logger = createLogger("ai-models");

const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];

export const EMBEDDING_DIM = 768;
const MODEL_ID = "Xenova/clip-vit-large-patch14";

let model: any = null;
let loadingPromise: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (model) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    logger.info(`Loading AI Model (Vision): ${MODEL_ID}...`);
    try {
      const { CLIPVisionModelWithProjection, env } = await import("@xenova/transformers");
      env.allowLocalModels = true;

      model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        quantized: true,
      });
      logger.info("AI Model loaded successfully.");
    } catch (e) {
      logger.error(`Failed to load AI model ${MODEL_ID}:`, e);
      throw e;
    }
  })();

  return loadingPromise;
}

export async function generateEmbedding(imagePath: string): Promise<number[]> {
  if (!model) await init();

  const { Tensor } = await import("@xenova/transformers");
  const sharp = (await import("sharp")).default;

  let processingPath = imagePath;
  let tempFile: string | null = null;

  try {
    // 1. Handle HEIC via vips copy
    const ext = path.extname(imagePath).toLowerCase();
    if (ext === ".heic" || ext === ".heif") {
      const tempDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), "ai-embed-"));
      tempFile = path.join(tempDirPath, `converted.jpg`);

      try {
        // Ensure paths are properly quoted for shell execution via execSync
        execSync(`vips copy "${imagePath}" "${tempFile}"`);
        processingPath = tempFile;
      } catch (vipsErr) {
        logger.warn(`Vips copy failed for AI embedding: ${vipsErr}`);
        throw vipsErr;
      }
    }

    const { data, info } = await sharp(processingPath)
      .resize(224, 224, { fit: "cover" }) // Resize + Center Crop
      .removeAlpha() // Ensure RGB
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels; // should be 3

    if (width !== 224 || height !== 224 || channels !== 3) {
      throw new Error(`Unexpected dimensions after resize: ${width}x${height}x${channels}`);
    }

    const floatData = new Float32Array(3 * 224 * 224);

    for (let i = 0; i < 224 * 224; i++) {
      const r = data[i * 3];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];

      floatData[i] = (r / 255.0 - CLIP_MEAN[0]) / CLIP_STD[0];
      floatData[i + 224 * 224] = (g / 255.0 - CLIP_MEAN[1]) / CLIP_STD[1];
      floatData[i + 2 * 224 * 224] = (b / 255.0 - CLIP_MEAN[2]) / CLIP_STD[2];
    }

    const tensor = new Tensor("float32", floatData, [1, 3, 224, 224]);

    const { image_embeds } = await model({ pixel_values: tensor });

    return Array.from(image_embeds.data);
  } catch (e) {
    logger.error(`Failed to generate embedding for ${imagePath}:`, e);
    return [];
  } finally {
    if (tempFile && fs.existsSync(path.dirname(tempFile))) {
      try {
        await fsp.rm(path.dirname(tempFile), { recursive: true, force: true });
      } catch (_ignore) {}
    }
  }
}

export const aiService = { init, generateEmbedding };
