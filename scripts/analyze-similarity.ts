import path from "node:path";
import { intro } from "@clack/prompts";
import { AutoTokenizer, CLIPTextModelWithProjection } from "@xenova/transformers";
import type {
  CurationGroup,
  CurationManifest,
  CurationRecommendation,
  ImageEntry,
} from "../src/lib/types/manifest";
import {
  calculateAestheticScore,
  createAestheticAxis,
  normalizeAestheticScore,
} from "./lib/aesthetic";
import { aiService } from "./lib/ai-models";
import { parseCliArguments } from "./lib/cli-parser";
import { resolveGalleryDirectory } from "./lib/gallery-resolver";
import { getQualityBucket, normalizeSharpness } from "./lib/image-utils";
import { createLogger } from "./lib/logger";
import {
  loadAnalysisManifest,
  loadEmbeddingsManifest,
  loadImagesManifest,
  saveAnalysisManifest,
  saveCurationManifest,
  saveEmbeddingsManifest,
  saveImagesManifest,
} from "./lib/manifest-repository";
import { createBar, removeBar, stopAllBars } from "./lib/progress-manager";
import { formatDuration } from "./lib/time-utils";

const logger = createLogger("analyze-similarity");

const options = parseCliArguments(process.argv.slice(2));
const values = options;

const BATCH_SIZE = values.batchSize;
const TIME_WINDOW_MS = values.timeWindow;

const CURATION_CONFIG = {
  similarityThreshold: 0.89,

  preferredAuthors: ["cebreus", "professionals"],
};

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const RESOLUTION_DIFFERENCE_THRESHOLD = 0.05;
const AESTHETIC_DIFFERENCE_THRESHOLD = 5;
const SHARPNESS_DIFFERENCE_THRESHOLD = 10;

function calculateImageArea(image: ImageEntry): number {
  return (image.width || 0) * (image.height || 0);
}

function getAestheticScore(image: ImageEntry): number {
  return image.analysis?.aestheticScore || 0;
}

function getSharpness(image: ImageEntry): number {
  return image.analysis?.sharpness || 0;
}

function _getDefaultAnalysis() {
  return { sharpness: 0, aestheticScore: 0, phash: "" };
}

function compareByImageQuality(imageA: ImageEntry, imageB: ImageEntry): number {
  const areaA = calculateImageArea(imageA);
  const areaB = calculateImageArea(imageB);
  const maxArea = Math.max(areaA, areaB);
  const areaDifference = maxArea > 0 ? Math.abs(areaA - areaB) / maxArea : 0;

  if (areaDifference > RESOLUTION_DIFFERENCE_THRESHOLD) {
    return areaB - areaA;
  }

  const aestheticA = getAestheticScore(imageA);
  const aestheticB = getAestheticScore(imageB);

  if (Math.abs(aestheticA - aestheticB) > AESTHETIC_DIFFERENCE_THRESHOLD) {
    return aestheticB - aestheticA;
  }

  const sharpnessA = getSharpness(imageA);
  const sharpnessB = getSharpness(imageB);

  if (Math.abs(sharpnessA - sharpnessB) > SHARPNESS_DIFFERENCE_THRESHOLD) {
    return sharpnessB - sharpnessA;
  }

  return 0;
}

function extractImageId(image: ImageEntry): string {
  return image.id;
}

function buildDeleteReasons(best: ImageEntry, photo: ImageEntry): string[] {
  const reasons: string[] = [];

  if (calculateImageArea(best) > calculateImageArea(photo)) {
    reasons.push("Lower resolution");
  }

  const bestAesthetic = getAestheticScore(best);
  const photoAesthetic = getAestheticScore(photo);

  if (bestAesthetic > photoAesthetic + AESTHETIC_DIFFERENCE_THRESHOLD) {
    reasons.push(`Lower aesthetics (${photoAesthetic.toFixed(0)} vs ${bestAesthetic.toFixed(0)})`);
  }

  if (getSharpness(best) > getSharpness(photo)) {
    reasons.push("Less sharp");
  }

  return reasons;
}

function buildRecommendation(best: ImageEntry, photo: ImageEntry): CurationRecommendation {
  if (photo.id === best.id) {
    return { action: "keep", reason: "Best candidate" };
  }

  const reasons = buildDeleteReasons(best, photo);
  return {
    action: "delete",
    reason: reasons.length > 0 ? reasons.join(", ") : "Semantic duplicate",
  };
}

function evaluateGroup(photos: ImageEntry[]): CurationGroup {
  const groupId = `group-${photos[0].id}`;
  const sortedByQuality = [...photos].sort(compareByImageQuality);
  const best = sortedByQuality[0];

  const recommendations: Record<string, CurationRecommendation> = {};
  for (const photo of sortedByQuality) {
    recommendations[photo.id] = buildRecommendation(best, photo);
  }

  return {
    id: groupId,
    items: photos.map(extractImageId),
    bestCandidateId: best.id,
    similarity: 0,
    recommendations,
  };
}

const POSITIVE_PROMPT =
  "composition, authenticity, documentary photography, balanced colors, sharp focus, clear subject, award winning";
const NEGATIVE_PROMPT =
  "bad composition, blur, low resolution, artifacts, distorted, amateur, poor lighting";

async function getEmbedding(text: string, tokenizer: any, textModel: any): Promise<number[]> {
  const inputs = tokenizer([text], { padding: true, truncation: true });
  const { text_embeds } = await textModel(inputs);
  return text_embeds.data;
}

// ... existing code ...

async function computeAestheticScores(
  manifest: any,
  tokenizer: any,
  textModel: any,
  srcRoot: string,
  embeddingsManifest: Record<string, number[]>,
): Promise<{ allImages: ImageEntry[]; missingAestheticCount: number }> {
  const posEmbedding = await getEmbedding(POSITIVE_PROMPT, tokenizer, textModel);
  const negEmbedding = await getEmbedding(NEGATIVE_PROMPT, tokenizer, textModel);
  const aestheticAxis = createAestheticAxis(posEmbedding, negEmbedding);

  const allImages: ImageEntry[] = [];
  let missingAestheticCount = 0;

  // Calculate total images for progress bar
  let totalImages = 0;
  // If limit is set, use it as the total count (clamped to actual total)
  let maxImages = Number.parseInt(String(values.limit || "0"), 10);

  let actualTotal = 0;
  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") actualTotal++;
    }
  }

  if (maxImages > 0 && maxImages < actualTotal) {
    totalImages = maxImages;
  } else {
    totalImages = actualTotal;
    // If limit is 0 or undefined, treat as no limit (Infinity)
    if (maxImages === 0) maxImages = Infinity;
  }

  /*
  const bar = !values.verbose
    ? new SingleBar({
        format: `[analyze-similarity] [{bar}] {percentage}% | {value}/{total}`,
        hideCursor: true,
        clearOnComplete: false,
      })
    : null;
  */
  const barTotal = Math.max(totalImages, 1);
  const bar = createBar(barTotal, "analyze-similarity");
  let processedCount = 0;
  let generatedEmbeddings = 0;
  let cachedEmbeddings = 0;
  let failedEmbeddings = 0;
  const imagesToEmbed: { img: ImageEntry; absPath: string }[] = [];

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const imgEntry = item as ImageEntry;
        if (!imgEntry.analysis) imgEntry.analysis = { sharpness: 0, phash: "", embedding: [] };
        if (imgEntry.analysis?.embedding && imgEntry.analysis.embedding.length > 0) {
          cachedEmbeddings++;
          // already in current run's memory (just in case)
        } else if (embeddingsManifest[imgEntry.id]) {
          imgEntry.analysis = imgEntry.analysis || { sharpness: 0, phash: "" };
          imgEntry.analysis.embedding = embeddingsManifest[imgEntry.id];
          cachedEmbeddings++;
        } else {
          const filename = path.basename(imgEntry.src);
          const galleryDir = path.basename(path.dirname(srcRoot));

          // Heuristic: Try to use a thumbnail if it exists (MUCH faster than high-res decoding)
          const webVariants = [
            path.resolve(process.cwd(), `static/${galleryDir}/xl/${filename}`),
            path.resolve(process.cwd(), `static/${galleryDir}/lg/${filename}`),
          ];

          let bestPath = path.join(srcRoot, filename);
          for (const p of webVariants) {
            if (await Bun.file(p).exists()) {
              bestPath = p;
              break;
            }
          }

          imagesToEmbed.push({
            img: imgEntry,
            absPath: bestPath,
          });
        }

        // If we have a limit, we shouldn't gather more than that for embedding either
        if (maxImages > 0 && imagesToEmbed.length >= maxImages) break;
      }
    }
    if (maxImages > 0 && imagesToEmbed.length >= maxImages) break;
  }

  if (imagesToEmbed.length > 0) {
    logger.info(
      `Generating embeddings for ${imagesToEmbed.length} images in batches of ${BATCH_SIZE}...`,
    );
    const embedBar = createBar(imagesToEmbed.length, "generate-embeddings");
    for (let i = 0; i < imagesToEmbed.length; i += BATCH_SIZE) {
      const batch = imagesToEmbed.slice(i, i + BATCH_SIZE);
      const paths = batch.map((b) => b.absPath);
      try {
        const embeddings = await aiService.generateEmbeddingsBatch(paths);
        for (let j = 0; j < batch.length; j++) {
          const analysis = batch[j].img.analysis;
          if (analysis) {
            analysis.embedding = embeddings[j];
          }
        }
        generatedEmbeddings += batch.length;
      } catch (e) {
        logger.error(`Failed batch at offset ${i}:`, e);
        failedEmbeddings += batch.length;
      }
      if (embedBar) embedBar.update(Math.min(i + batch.length, imagesToEmbed.length));
      // Update main bar as well, but only halfway through total progress since aesthetic scoring follows?
      // Or just update it as we go.
      if (bar)
        bar.update(Math.floor(((i + batch.length) / imagesToEmbed.length) * (totalImages * 0.5)));
    }
    if (embedBar) removeBar(embedBar);
  }

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const imgEntry = item as ImageEntry;

        if (imgEntry.analysis?.embedding && imgEntry.analysis.embedding.length > 0) {
          const rawScore = calculateAestheticScore(imgEntry.analysis.embedding, aestheticAxis);
          const score = normalizeAestheticScore(rawScore);

          const previousAesthetic = imgEntry.analysis.aestheticScore;
          imgEntry.analysis.aestheticScore = score;

          const rawSharpness = imgEntry.analysis.sharpness || 0;
          let sharpness = rawSharpness;
          if (rawSharpness > 100) {
            sharpness = normalizeSharpness(rawSharpness);
          }

          imgEntry.analysis.aestheticScore = score;
          imgEntry.analysis.sharpness = sharpness;
          const qualityBucket = getQualityBucket(score, sharpness);
          imgEntry.analysis.qualityBucket = qualityBucket;

          if (previousAesthetic === undefined || previousAesthetic === 0) {
            missingAestheticCount++;
          }

          imgEntry.analysis = {
            aestheticScore: score,
            sharpness: sharpness,
            qualityBucket: qualityBucket,
            phash: imgEntry.analysis.phash || "",
            ...Object.fromEntries(
              Object.entries(imgEntry.analysis).filter(
                ([k]) =>
                  ![
                    "aestheticScore",
                    "sharpness",
                    "qualityBucket",
                    "phash",
                    "facesDetected",
                    "faces",
                    "embedding",
                  ].includes(k),
              ),
            ),
            embedding: imgEntry.analysis.embedding,
          };

          allImages.push(imgEntry);
        }

        processedCount++;
        if (bar) {
          bar.update(processedCount);
        }

        if (maxImages > 0 && processedCount >= maxImages) {
          break;
        }
      }
    }
    if (maxImages > 0 && processedCount >= maxImages) {
      break;
    }
  }
  const summarySuffix = `Processed: ${generatedEmbeddings} | Cached: ${cachedEmbeddings} | Failed: ${failedEmbeddings}`;
  if (bar) {
    bar.update(barTotal, { suffix: summarySuffix });
    (bar as any).stop?.();
    stopAllBars();
  }
  // logger.info(`Summary — ${summarySuffix}`);
  // bar?.stop();
  // if (!values.verbose) process.stdout.write("\n");

  return { allImages, missingAestheticCount };
}

function clusterImagesBySimilarity(images: ImageEntry[]): CurationGroup[] {
  const groups: CurationGroup[] = [];
  const assigned = new Set<string>();

  // Sort images by timestamp to enable time-windowing
  const sortedImages = [...images].sort((a, b) => {
    const timeA = a.exif?.date ? new Date(a.exif.date).getTime() : 0;
    const timeB = b.exif?.date ? new Date(b.exif.date).getTime() : 0;
    return timeA - timeB;
  });

  for (let i = 0; i < sortedImages.length; i++) {
    const photoA = sortedImages[i];
    if (assigned.has(photoA.id)) continue;

    const groupPhotos = [photoA];
    assigned.add(photoA.id);

    const timeA = photoA.exif?.date ? new Date(photoA.exif.date).getTime() : 0;

    if (photoA.analysis?.embedding) {
      for (let j = i + 1; j < sortedImages.length; j++) {
        const photoB = sortedImages[j];
        if (assigned.has(photoB.id)) continue;

        // Time Windowing Heuristic
        const timeB = photoB.exif?.date ? new Date(photoB.exif.date).getTime() : 0;
        if (timeA > 0 && timeB > 0) {
          const diff = Math.abs(timeA - timeB);
          if (diff > TIME_WINDOW_MS) {
            // Since it's sorted by time, we can stop early for subsequent photos if we're moving forward
            // Actually, if we're moving forward in i, we need to check if we can stop for j.
            // If sortedImages[j] is more than 4h from photoA, all subsequent are too.
            break;
          }
        }

        if (photoB.analysis?.embedding) {
          const similarity = cosineSimilarity(photoA.analysis.embedding, photoB.analysis.embedding);

          if (similarity > CURATION_CONFIG.similarityThreshold) {
            groupPhotos.push(photoB);
            assigned.add(photoB.id);
          }
        }
      }
    }

    if (groupPhotos.length > 1) {
      // Only groups of 2+ count as candidate duplicates
      groups.push(evaluateGroup(groupPhotos));
    }
  }

  return groups;
}

function updateManifestAnalysisKeys(_manifest: any) {
  // This function ensures that key properties like qualityBucket are preserved/updated
  // in the manifest object before saving, although we've been modifying image objects
  // directly which are references to manifest items.
  for (const day of _manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.analysis) {
        // Ensure quality bucket is updated based on potentially new scores
        item.analysis.qualityBucket = getQualityBucket(
          item.analysis.aestheticScore,
          item.analysis.sharpness,
        );
      }
    }
  }
}

async function main() {
  intro("🧠 Similarity Analysis");

  const contentDir = await resolveGalleryDirectory();

  if (values.verbose) {
    logger.info(`Analyzing content for: ${contentDir}`);
  }

  if (values.manifestOnly) {
    logger.info("Manifest-only mode: Skipping analysis.");
    return;
  }

  // Use Repository
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const srcRoot = path.resolve(process.cwd(), `content/${contentDir}/pics`);

  const manifest = await loadImagesManifest(dataDir);
  const analysisManifest = (await loadAnalysisManifest(dataDir)) || {};
  const embeddingsManifest = (await loadEmbeddingsManifest(dataDir)) || {};

  if (!manifest) {
    logger.error(`Manifest not found in ${dataDir}`);
    process.exit(1);
  }

  if (values.verbose) {
    logger.info("Loading CLIP text model for aesthetic scoring...");
  }

  const tokenizer = await AutoTokenizer.from_pretrained("Xenova/clip-vit-large-patch14");
  const textModel = await CLIPTextModelWithProjection.from_pretrained(
    "Xenova/clip-vit-large-patch14",
  );

  logger.info("Computing scores...");
  const { allImages, missingAestheticCount } = await computeAestheticScores(
    manifest,
    tokenizer,
    textModel,
    srcRoot,
    embeddingsManifest,
  );

  if (missingAestheticCount > 0) {
    logger.warn(`${missingAestheticCount} images had missing/zero aestheticScore. Recalculated.`);
  }

  if (values.verbose) {
    logger.info(`Loaded ${allImages.length} images with embeddings. Clustering...`);
  }

  const groups = clusterImagesBySimilarity(allImages);

  const result: CurationManifest = {
    groups,
    stats: {
      totalPhotos: allImages.length,
      totalGroups: groups.length,
      duplicatesFound: groups.reduce((acc, g) => acc + (g.items.length - 1), 0),
    },
  };

  if (values.verbose) {
    // Log top 10 aesthetic photos
    const topAesthetic = [...allImages]
      .sort((a, b) => (b.analysis?.aestheticScore || 0) - (a.analysis?.aestheticScore || 0))
      .slice(0, 10);
    logger.info("Top 10 Aesthetic Photos:");
    topAesthetic.forEach((p) => {
      logger.info(`  ${p.id}: ${(p.analysis?.aestheticScore || 0).toFixed(4)}`);
    });
  }

  updateManifestAnalysisKeys(manifest);

  // Update specialized manifests
  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const img = item as ImageEntry;
        const analysis = img.analysis;
        if (analysis) {
          analysisManifest[img.id] = {
            aestheticScore: analysis.aestheticScore,
            sharpness: analysis.sharpness,
            qualityBucket: analysis.qualityBucket,
            phash: analysis.phash,
          };
          if (analysis.embedding) {
            embeddingsManifest[img.id] = analysis.embedding;
          }
        }
      }
    }
  }

  // Save via Repository
  await saveImagesManifest(dataDir, manifest);
  await saveAnalysisManifest(dataDir, analysisManifest);
  await saveEmbeddingsManifest(dataDir, embeddingsManifest);

  await saveCurationManifest(dataDir, result);

  logger.info(`Analysis complete. Found ${result.stats.totalGroups} groups.`);
}

const startTime = performance.now();
main().then(() => {
  logger.info(`Total time: ${formatDuration(performance.now() - startTime)}`);
});
