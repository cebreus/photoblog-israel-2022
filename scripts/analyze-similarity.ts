import { intro } from "@clack/prompts";
import { AutoTokenizer, CLIPTextModelWithProjection } from "@xenova/transformers";
import path from "node:path";
import { parseArgs } from "node:util";
import type {
    CurationGroup,
    CurationManifest,
    CurationRecommendation,
    ImageEntry
} from "../src/lib/types/manifest";
import {
    calculateAestheticScore,
    createAestheticAxis,
    normalizeAestheticScore,
} from "./lib/aesthetic";
import { aiService } from "./lib/ai-models";
import { resolveGalleryDirectory } from "./lib/gallery-resolver";
import { getQualityBucket, normalizeSharpness } from "./lib/image-utils";
import { createLogger } from "./lib/logger";
import {
    loadImagesManifest,
    saveCurationManifest,
    saveImagesManifest,
} from "./lib/manifest-repository";
import { progressManager } from "./lib/progress-manager";

const logger = createLogger("analyze-similarity");

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    verbose: {
      type: "boolean",
    },
    limit: {
      type: "string",
    },
    clean: {
      type: "boolean",
    },
    "manifest-only": {
      type: "boolean",
    },
    curation: {
      type: "boolean",
    },
  },
  strict: false,
  allowPositionals: true,
});


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
  srcRoot: string
): Promise<{ allImages: ImageEntry[]; missingAestheticCount: number }> {
  const posEmbedding = await getEmbedding(POSITIVE_PROMPT, tokenizer, textModel);
  const negEmbedding = await getEmbedding(NEGATIVE_PROMPT, tokenizer, textModel);
  const aestheticAxis = createAestheticAxis(posEmbedding, negEmbedding);

  const allImages: ImageEntry[] = [];
  let missingAestheticCount = 0;

  // Calculate total images for progress bar
  let totalImages = 0;
  // If limit is set, use it as the total count (clamped to actual total)
  let maxImages = Number.parseInt(values.limit || "0", 10);
  
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
  const bar = progressManager.createBar(totalImages, "analyze-similarity");

  // bar?.start(totalImages, 0); // createBar initializes
  let processedCount = 0;

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const imgEntry = item as ImageEntry;
        if (!imgEntry.analysis) imgEntry.analysis = { sharpness: 0, phash: "", embedding: [] };

        // Lazy-generate embedding if missing
        if (!imgEntry.analysis.embedding || imgEntry.analysis.embedding.length === 0) {
            const absPath = path.join(srcRoot, path.basename(imgEntry.src));
            try {
                imgEntry.analysis.embedding = await aiService.generateEmbedding(absPath);
            } catch (e) {
                console.warn(`Failed to generate embedding for ${imgEntry.id}:`, e);
                continue; // Skip this image if embedding fails
            }
        }

        if (imgEntry.analysis.embedding && imgEntry.analysis.embedding.length > 0) {
            const rawScore = calculateAestheticScore(imgEntry.analysis.embedding!, aestheticAxis);
            const score = normalizeAestheticScore(rawScore);

            const previousAesthetic = imgEntry.analysis.aestheticScore;
            imgEntry.analysis.aestheticScore = score;

            const rawSharpness = imgEntry.analysis.sharpness || 0;
            let sharpness = rawSharpness;
            // Heuristic: if sharpness is > 100, it's likely raw and needs normalization
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

            // Reorder keys specifically for manifest consistency
            // Exclude redundant 'faces' and 'facesDetected' as they are handled by Step 6 (people manifest)
            imgEntry.analysis = {
                aestheticScore: score,
                sharpness: sharpness,
                qualityBucket: qualityBucket,
                phash: imgEntry.analysis.phash || "",
                ...Object.fromEntries(
                    Object.entries(imgEntry.analysis).filter(([k]) => 
                        !["aestheticScore", "sharpness", "qualityBucket", "phash", "facesDetected", "faces", "embedding"].includes(k)
                    )
                ),
                embedding: imgEntry.analysis.embedding
            };

            allImages.push(imgEntry);
        }
        
        processedCount++;
        if (bar) {
            bar.update(processedCount);
        } else if (values.verbose && (processedCount % 10 === 0 || processedCount === totalImages)) {
             // Fallback if bar somehow failed, though ProgressManager handles verbose logs concurrent with bar
             // But if bar exists (which it should), we just update it.
             // If we really want to log explicitly in verbose loop we can, but ProgressManager.log() does it cleanly.
             // For now, let's trust the bar.
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
  
  if (bar) progressManager.removeBar(bar);
  // bar?.stop();
  // if (!values.verbose) process.stdout.write("\n");

  return { allImages, missingAestheticCount };
}

function clusterImagesBySimilarity(images: ImageEntry[]): CurationGroup[] {
  const groups: CurationGroup[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < images.length; i++) {
    const photoA = images[i];
    if (assigned.has(photoA.id)) continue;

    const groupPhotos = [photoA];
    assigned.add(photoA.id);

    if (photoA.analysis?.embedding) {
        for (let j = i + 1; j < images.length; j++) {
        const photoB = images[j];
        if (assigned.has(photoB.id)) continue;

        if (photoB.analysis?.embedding) {
            const similarity = cosineSimilarity(
            photoA.analysis.embedding,
            photoB.analysis.embedding,
            );

            if (similarity > CURATION_CONFIG.similarityThreshold) {
            groupPhotos.push(photoB);
            assigned.add(photoB.id);
            }
        }
        }
    }

    if (groupPhotos.length > 0) {
      groups.push(evaluateGroup(groupPhotos));
    }
  }

  return groups;
}

function updateManifestAnalysisKeys(manifest: import("../src/lib/types/manifest").ImagesManifest) {
    // This function ensures that key properties like qualityBucket are preserved/updated
    // in the manifest object before saving, although we've been modifying image objects 
    // directly which are references to manifest items. 
    // So this might just be a no-op or sanity check in this specific implementation 
    // since we modified the objects in place during `computeAestheticScores`.
    
    // However, if we needed to sync global stats or versioning, we'd do it here.
    // For now, let's just ensure strict typing if needed.
    return;
}

async function main() {
  intro("🧠 Similarity Analysis");

  const contentDir = await resolveGalleryDirectory();
  
  if (values.verbose) {
      logger.info(`Analyzing content for: ${contentDir}`);
  }

  if (values["manifest-only"]) {
      logger.info("Manifest-only mode: Skipping similarity analysis.");
      return;
  }

  // Use Repository
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const srcRoot = path.resolve(process.cwd(), `content/${contentDir}/pics`); 
  
  const manifest = await loadImagesManifest(dataDir);
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
    srcRoot
  );

  if (missingAestheticCount > 0) {
    logger.warn(
      `${missingAestheticCount} images had missing/zero aestheticScore. Recalculated.`,
    );
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

  // Save via Repository
  await saveImagesManifest(dataDir, manifest);
  
  await saveCurationManifest(dataDir, result);
  
  logger.info(`Analysis complete. Found ${result.stats.totalGroups} groups.`);
}

main();
