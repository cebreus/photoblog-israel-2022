import path from "node:path";
import { createLogger } from "$scripts/core/cli-logger";
import { prepareImageProcessingPath } from "$scripts/image/utils";
import { safeRm } from "$scripts/utils/runtime";

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
    logger.info({ modelId: MODEL_ID }, "Loading AI Model (Vision)");
    try {
      const { CLIPVisionModelWithProjection, env } = await import("@xenova/transformers");

      // Configure environment for local execution
      env.allowLocalModels = true;
      env.allowRemoteModels = true;
      env.cacheDir = path.resolve(process.cwd(), "scripts/models/ai");
      env.useBrowserCache = false;

      // Disable worker/proxy for ONNX which is the common source of blob: URLs
      if ((env as any).backends?.onnx) {
        (env as any).backends.onnx.wasm.proxy = false;
      }

      model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        quantized: true,
      });
      logger.info({ modelId: MODEL_ID }, "AI Model loaded successfully");
    } catch (error: any) {
      logger.error(
        { modelId: MODEL_ID, err: error.message, stack: error.stack },
        "Failed to load AI model (Vision)",
      );
      throw error;
    }
  })();

  return loadingPromise;
}

async function prepareTensor(
  imagePath: string,
): Promise<{ tensor: any; tempFile: string | null } | null> {
  const { Tensor } = await import("@xenova/transformers");
  const sharp = (await import("sharp")).default;

  let processingPath = imagePath;
  let tempFile: string | null = null;

  try {
    const { processingPath: resolvedPath, tempFile: contextTempFile } =
      await prepareImageProcessingPath(imagePath);
    processingPath = resolvedPath;
    tempFile = contextTempFile;

    const { data } = await sharp(processingPath)
      .resize(224, 224, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const floatData = new Float32Array(3 * 224 * 224);
    for (let i = 0; i < 224 * 224; i++) {
      floatData[i] = (data[i * 3] / 255.0 - CLIP_MEAN[0]) / CLIP_STD[0];
      floatData[i + 224 * 224] = (data[i * 3 + 1] / 255.0 - CLIP_MEAN[1]) / CLIP_STD[1];
      floatData[i + 2 * 224 * 224] = (data[i * 3 + 2] / 255.0 - CLIP_MEAN[2]) / CLIP_STD[2];
    }

    return { tensor: new Tensor("float32", floatData, [1, 3, 224, 224]), tempFile };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(
      {
        path: imagePath,
        message: error.message,
        stack: error.stack,
      },
      "Failed to prepare tensor",
    );
    // Use async check for directory existence using node:fs/promises access equivalent or try/catch
    if (!tempFile) return null;
    await safeRm(path.dirname(tempFile));
    return null;
  }
}

export async function generateEmbedding(imagePath: string): Promise<number[]> {
  const result = await generateEmbeddingsBatch([imagePath]);
  return result[0] || [];
}

export async function generateEmbeddingsBatch(imagePaths: string[]): Promise<number[][]> {
  if (imagePaths.length === 0) return [];
  if (!model) await init();

  const { Tensor } = await import("@xenova/transformers");
  const prepared = await Promise.all(imagePaths.map((imagePath) => prepareTensor(imagePath)));
  const valid = prepared.filter(
    (item): item is { tensor: any; tempFile: string | null } => item !== null,
  );

  if (valid.length === 0) return imagePaths.map(() => []);

  try {
    const batchedData = new Float32Array(valid.length * 3 * 224 * 224);
    for (let i = 0; i < valid.length; i++) {
      batchedData.set(valid[i].tensor.data, i * 3 * 224 * 224);
    }

    const batchedTensor = new Tensor("float32", batchedData, [valid.length, 3, 224, 224]);
    const { image_embeds } = await model({ pixel_values: batchedTensor });

    const results: number[][] = [];
    const dim = image_embeds.dims[1]; // should be 768
    for (let i = 0; i < valid.length; i++) {
      results.push(Array.from(image_embeds.data.slice(i * dim, (i + 1) * dim)));
    }

    // Map back to original order (some might have failed)
    let validIdx = 0;
    return imagePaths.map((_path, idx) => {
      if (prepared[idx]) {
        return results[validIdx++];
      }
      return [];
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to generate embeddings batch");
    return imagePaths.map(() => []);
  } finally {
    const toCleanup = valid.map((p) => p.tempFile).filter((f): f is string => !!f);
    await Promise.all(toCleanup.map((f) => safeRm(path.dirname(f))));
  }
}

export const aiService = { init, generateEmbedding, generateEmbeddingsBatch };
