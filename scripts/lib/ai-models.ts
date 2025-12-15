import { CLIPVisionModelWithProjection, Tensor, env } from "@xenova/transformers";
import sharp from "sharp";
import { createLogger } from "./logger";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Configure local cache usage
env.allowLocalModels = true;

const logger = createLogger("ai-models");

// CLIP normalization constants (OpenAI default)
const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];

class AIModelService {
  private static instance: AIModelService;
  private model: any = null;
  private modelId = "Xenova/clip-vit-large-patch14";

  private constructor() {}

  public static getInstance(): AIModelService {
    if (!AIModelService.instance) {
      AIModelService.instance = new AIModelService();
    }
    return AIModelService.instance;
  }

  /**
   * Initializes the model if not already loaded.
   */
  async init(): Promise<void> {
    if (this.model) return;

    logger.info(`Loading AI Model (Vision): ${this.modelId}...`);
    try {
      // Only load model, we handle processing manually
      this.model = await CLIPVisionModelWithProjection.from_pretrained(this.modelId, {
        quantized: true,
      });
      logger.info("AI Model loaded successfully.");
    } catch (e) {
      logger.error(`Failed to load AI model ${this.modelId}:`, e);
      throw e;
    }
  }

  /**
   * Generates a semantic embedding for the given image.
   * @param imagePath Absolute path to the image
   * @returns Array of numbers (embedding vector)
   */
  async generateEmbedding(imagePath: string): Promise<number[]> {
    if (!this.model) await this.init();

    let processingPath = imagePath;
    let tempFile: string | null = null;

    try {
      // 1. Handle HEIC via vips copy
      const ext = path.extname(imagePath).toLowerCase();
      if (ext === ".heic" || ext === ".heif") {
        const tmpDir = os.tmpdir();
        const rid = Math.random().toString(36).substring(7);
        tempFile = path.join(tmpDir, `ai_temp_${rid}.jpg`);

        try {
          execSync(`vips copy "${imagePath}" "${tempFile}"`);
          processingPath = tempFile;
        } catch (vipsErr) {
          logger.warn(`Vips copy failed for AI embedding: ${vipsErr}`);
          throw vipsErr;
        }
      }

      // 2. Manual Preprocessing (Resize -> Tensor)
      // CLIP expects 224x224.
      // We ignore aspect ratio (fill) or use center crop?
      // Standard AutoProcessor uses ShortestEdge=224 then CenterCrop.
      // For simplicity/speed, we resize to 224x224 fill?
      // CenterCrop is better for preserving aspect ratio semantics.
      // Let's do: Resize shortest edge to 224, then extract center 224x224.
      // Sharp handles this with 'resize({ width: 224, height: 224, fit: 'cover' })' -> this is Center Crop!

      const { data, info } = await sharp(processingPath)
        .resize(224, 224, { fit: "cover" }) // Resize + Center Crop
        .removeAlpha() // Ensure RGB
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 3. Create Tensor [1, 3, 224, 224]
      // Data is [R, G, B, R, G, B ...]
      const width = info.width;
      const height = info.height;
      const channels = info.channels; // should be 3

      if (width !== 224 || height !== 224 || channels !== 3) {
        throw new Error(`Unexpected dimensions after resize: ${width}x${height}x${channels}`);
      }

      const floatData = new Float32Array(3 * 224 * 224);

      // Iterate pixels and populate channel planes (CHW format)
      // data index: i (R), i+1 (G), i+2 (B)
      // tensor data: [R...][G...][B...]
      for (let i = 0; i < 224 * 224; i++) {
        const r = data[i * 3];
        const g = data[i * 3 + 1];
        const b = data[i * 3 + 2];

        // Normalize: (val/255 - mean) / std
        floatData[i] = (r / 255.0 - CLIP_MEAN[0]) / CLIP_STD[0];
        floatData[i + 224 * 224] = (g / 255.0 - CLIP_MEAN[1]) / CLIP_STD[1];
        floatData[i + 2 * 224 * 224] = (b / 255.0 - CLIP_MEAN[2]) / CLIP_STD[2];
      }

      const tensor = new Tensor("float32", floatData, [1, 3, 224, 224]);

      // 4. Inference
      const { image_embeds } = await this.model({ pixel_values: tensor });

      // image_embeds is a Tensor [1, 512]
      return Array.from(image_embeds.data);
    } catch (e) {
      logger.error(`Failed to generate embedding for ${imagePath}:`, e);
      return [];
    } finally {
      if (tempFile && fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (ignore) {}
      }
    }
  }
}

export const aiService = AIModelService.getInstance();
