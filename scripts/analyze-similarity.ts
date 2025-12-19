import { intro } from "@clack/prompts";
import { AutoTokenizer, CLIPTextModelWithProjection } from "@xenova/transformers";
import path from "node:path";
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
import { resolveGalleryDirectory } from "./lib/gallery-resolver";
import { getQualityBucket } from "./lib/image-utils";
import {
  loadImagesManifest,
  saveCurationManifest,
  saveImagesManifest,
} from "./lib/manifest-repository";

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

async function computeAestheticScores(
  manifest: any,
  tokenizer: any,
  textModel: any,
): Promise<{ allImages: ImageEntry[]; missingAestheticCount: number }> {
  const posEmbedding = await getEmbedding(POSITIVE_PROMPT, tokenizer, textModel);
  const negEmbedding = await getEmbedding(NEGATIVE_PROMPT, tokenizer, textModel);
  const aestheticAxis = createAestheticAxis(posEmbedding, negEmbedding);

  const allImages: ImageEntry[] = [];
  let missingAestheticCount = 0;

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.analysis?.embedding) {
        const imgEntry = item as ImageEntry;
        if (!imgEntry.analysis) imgEntry.analysis = { sharpness: 0, phash: "", embedding: [] };

        const rawScore = calculateAestheticScore(imgEntry.analysis.embedding!, aestheticAxis);
        const score = normalizeAestheticScore(rawScore);

        const previousAesthetic = imgEntry.analysis.aestheticScore;
        imgEntry.analysis.aestheticScore = score;

        const sharpness = imgEntry.analysis.sharpness || 0;
        imgEntry.analysis.qualityBucket = getQualityBucket(score, sharpness);

        if (previousAesthetic === undefined || previousAesthetic === 0) {
          missingAestheticCount++;
        }

        allImages.push(imgEntry);
      }
    }
  }

  return { allImages, missingAestheticCount };
}

function clusterImagesBySimilarity(allImages: ImageEntry[]): CurationGroup[] {
  const visited = new Set<string>();
  const groups: CurationGroup[] = [];

  for (let i = 0; i < allImages.length; i++) {
    const seed = allImages[i];
    if (visited.has(seed.id)) continue;

    const cluster = [seed];
    visited.add(seed.id);

    for (let j = i + 1; j < allImages.length; j++) {
      const candidate = allImages[j];
      if (visited.has(candidate.id)) continue;

      const seedEmbed = seed.analysis?.embedding;
      const candEmbed = candidate.analysis?.embedding;

      if (seedEmbed && candEmbed) {
        const sim = cosineSimilarity(seedEmbed, candEmbed);
        if (sim >= CURATION_CONFIG.similarityThreshold) {
          cluster.push(candidate);
          visited.add(candidate.id);
        }
      }
    }

    if (cluster.length > 1) {
      const group = evaluateGroup(cluster);
      let minSim = 1.0;
      for (const p of cluster) {
        if (p.id !== seed.id) {
          const sEmbed = seed.analysis?.embedding;
          const pEmbed = p.analysis?.embedding;
          if (sEmbed && pEmbed) {
            const s = cosineSimilarity(sEmbed, pEmbed);
            if (s < minSim) minSim = s;
          }
        }
      }
      group.similarity = minSim;
      groups.push(group);
    }
  }

  return groups;
}

function updateManifestAnalysisKeys(manifest: any): void {
  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.analysis) {
        const a: any = item.analysis as any;
        if (typeof a.aestheticScore !== "undefined") {
          const { aestheticScore, ...rest } = a;
          item.analysis = { aestheticScore, ...rest } as any;
        }
      }
    }
  }
}

async function main() {
  intro("🧠 Similarity Analysis");

  const contentDir = await resolveGalleryDirectory();
  console.log(`Analyzing content for: ${contentDir}`);

  // Use Repository
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const manifest = await loadImagesManifest(dataDir);
  if (!manifest) {
    console.error(`Manifest not found in ${dataDir}`);
    process.exit(1);
  }

  console.log("Loading CLIP text model for aesthetic scoring...");
  const tokenizer = await AutoTokenizer.from_pretrained("Xenova/clip-vit-large-patch14");
  const textModel = await CLIPTextModelWithProjection.from_pretrained(
    "Xenova/clip-vit-large-patch14",
  );

  console.log("Computing aesthetic scores...");
  const { allImages, missingAestheticCount } = await computeAestheticScores(
    manifest,
    tokenizer,
    textModel,
  );

  if (missingAestheticCount > 0) {
    console.warn(
      `⚠️  Warning: ${missingAestheticCount} images had missing or zero aestheticScore. qualityBucket has been recalculated.`,
    );
  }

  console.log(`Loaded ${allImages.length} images with embeddings. Clustering...`);
  const groups = clusterImagesBySimilarity(allImages);

  const result: CurationManifest = {
    groups,
    stats: {
      totalPhotos: allImages.length,
      totalGroups: groups.length,
      duplicatesFound: groups.reduce((acc, g) => acc + (g.items.length - 1), 0),
    },
  };

  // Log top 10 aesthetic photos
  const topAesthetic = [...allImages]
    .sort((a, b) => (b.analysis?.aestheticScore || 0) - (a.analysis?.aestheticScore || 0))
    .slice(0, 10);
  console.log("\nTop 10 Aesthetic Photos:");
  topAesthetic.forEach((p) => {
    console.log(`  ${p.id}: ${(p.analysis?.aestheticScore || 0).toFixed(4)}`);
  });

  updateManifestAnalysisKeys(manifest);

  // Save via Repository
  await saveImagesManifest(dataDir, manifest);
  console.log(`Updated manifest saved to ${dataDir}/images.manifest.json`);

  await saveCurationManifest(dataDir, result);
  console.log(`Analysis complete. Found ${result.stats.totalGroups} groups.`);
  console.log(`Results saved to ${dataDir}/curation.manifest.json`);
}

main();
