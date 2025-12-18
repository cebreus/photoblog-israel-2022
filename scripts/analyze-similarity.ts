import fs from "node:fs/promises";
import path from "node:path";
import { intro, select } from "@clack/prompts";
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
import { getQualityBucket } from "./lib/image-utils";
import {
  loadImagesManifest,
  saveCurationManifest,
  saveImagesManifest,
} from "./lib/manifest-repository";

const CURATION_CONFIG = {
  // Cosine Similarity Threshold
  // 1.0 = identical
  // 0.95 = very similar
  // 0.90 = likely same subject/motif
  // 0.85 = usually distinct
  similarityThreshold: 0.89, // Tuned for Xenova/clip-vit-large-patch14

  preferredAuthors: ["cebreus", "professionals"],
};

/**
 * Calculates the cosine similarity between two vectors of numbers.
 */
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

/**
 * Evaluates a group of photos to find the best candidate and generate recommendations.
 */
function evaluateGroup(photos: ImageEntry[]): CurationGroup {
  const groupId = `group-${photos[0].id}`;

  // Sort logic (descending = best first):
  // 1. Resolution
  // 2. Sharpness
  // 3. Author
  // 4. Date

  const sorted = [...photos].sort((a, b) => {
    const analysisA = a.analysis || { sharpness: 0, aestheticScore: 0, phash: "" };
    const analysisB = b.analysis || { sharpness: 0, aestheticScore: 0, phash: "" };

    // 1. Resolution (Higher is better)
    const areaA = (a.width || 0) * (a.height || 0);
    const areaB = (b.width || 0) * (b.height || 0);
    if (Math.abs(areaA - areaB) / Math.max(areaA, areaB) > 0.05) {
      return areaB - areaA;
    }

    // 2. Aesthetic Score (Higher is better)
    const aestheticA = analysisA.aestheticScore || 0;
    const aestheticB = analysisB.aestheticScore || 0;
    // Significant difference threshold (e.g. 5 points on 0-100 scale)
    if (Math.abs(aestheticA - aestheticB) > 5) {
      return aestheticB - aestheticA;
    }

    // 3. Sharpness (Higher is better)
    const sharpA = analysisA.sharpness || 0;
    const sharpB = analysisB.sharpness || 0;
    if (Math.abs(sharpA - sharpB) > 10) {
      return sharpB - sharpA;
    }

    return 0;
  });

  const best = sorted[0];
  const recommendations: Record<string, CurationRecommendation> = {};

  // Calculate min similarity in this group (pairwise) to just report it?
  // Let's report similarity to BEST candidate

  sorted.forEach((photo) => {
    if (photo.id === best.id) {
      recommendations[photo.id] = { action: "keep", reason: "Best candidate" };
    } else {
      const reasons = [];
      if ((best.width || 0) * (best.height || 0) > (photo.width || 0) * (photo.height || 0)) {
        reasons.push("Lower resolution");
      }
      if ((best.analysis?.aestheticScore || 0) > (photo.analysis?.aestheticScore || 0) + 5) {
        reasons.push(
          `Lower aesthetics (${(photo.analysis?.aestheticScore || 0).toFixed(0)} vs ${(best.analysis?.aestheticScore || 0).toFixed(0)})`,
        );
      }
      if ((best.analysis?.sharpness || 0) > (photo.analysis?.sharpness || 0)) {
        reasons.push("Less sharp");
      }
      recommendations[photo.id] = {
        action: "delete",
        reason: reasons.length ? reasons.join(", ") : "Semantic duplicate",
      };
    }
  });

  return {
    id: groupId,
    items: photos.map((p) => p.id),
    bestCandidateId: best.id,
    similarity: 0, // Placeholder
    recommendations,
  };
}

/**
 * Analyzes image embeddings to calculate aesthetic scores and identify similar image groups.
 */
async function main() {
  intro("🧠 Similarity Analysis");

  let contentDir = process.env.CONTENT_DIR;
  if (!contentDir) {
    const contentDirRoot = path.resolve("content");
    const entries = await fs.readdir(contentDirRoot, { withFileTypes: true });
    const galleries = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    if (galleries.length === 0) {
      console.error("No galleries found");
      process.exit(1);
    }

    if (galleries.length === 1) {
      contentDir = galleries[0];
    } else {
      const galleryId = await select({
        message: "Select a gallery to analyze:",
        options: galleries.map((g) => ({ value: g, label: g })),
      });
      if (typeof galleryId !== "string") process.exit(0);
      contentDir = galleryId;
    }
  }

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

  // 1. Calculate embeddings for Positive and Negative prompts
  const positivePrompt =
    "composition, authenticity, documentary photography, balanced colors, sharp focus, clear subject, award winning";
  const negativePrompt =
    "bad composition, blur, low resolution, artifacts, distorted, amateur, poor lighting";

  console.log("Computing prompt embeddings...");

  const getEmbedding = async (text: string) => {
    const inputs = tokenizer([text], { padding: true, truncation: true });
    const { text_embeds } = await textModel(inputs);
    // It has shape [1, 768].
    return text_embeds.data;
  };

  const posEmbedding = await getEmbedding(positivePrompt);
  const negEmbedding = await getEmbedding(negativePrompt);

  // 2. Define Aesthetic Axis (Positive - Negative)
  const aestheticAxis = createAestheticAxis(posEmbedding, negEmbedding);
  console.log(`Aesthetic Axis Length: ${aestheticAxis.length}`);

  const allImages: ImageEntry[] = [];
  let missingAestheticCount = 0;

  manifest.photoDays.forEach((day) => {
    day.items.forEach((item) => {
      if (item.type === "image" && item.analysis?.embedding) {
        const imgEntry = item as ImageEntry;
        // Calculate Aesthetic Score
        const rawScore = calculateAestheticScore(imgEntry.analysis.embedding!, aestheticAxis);
        const score = normalizeAestheticScore(rawScore);

        // Update the entry in the manifest (in memory)
        if (!imgEntry.analysis) imgEntry.analysis = { sharpness: 0, phash: "", embedding: [] };

        const previousAesthetic = imgEntry.analysis.aestheticScore;
        imgEntry.analysis.aestheticScore = score;

        // Recalculate qualityBucket with the new aestheticScore
        const sharpness = imgEntry.analysis.sharpness || 0;
        imgEntry.analysis.qualityBucket = getQualityBucket(score, sharpness);

        // Validation: warn if aestheticScore was missing
        if (previousAesthetic === undefined || previousAesthetic === 0) {
          missingAestheticCount++;
        }

        allImages.push(imgEntry);
      }
    });
  });

  if (missingAestheticCount > 0) {
    console.warn(
      `⚠️  Warning: ${missingAestheticCount} images had missing or zero aestheticScore. qualityBucket has been recalculated.`,
    );
  }

  console.log(`Loaded ${allImages.length} images with embeddings.`);

  const visited = new Set<string>();
  const groups: CurationGroup[] = [];

  // Greedy clustering
  for (let i = 0; i < allImages.length; i++) {
    const seed = allImages[i];
    if (visited.has(seed.id)) continue;

    const cluster = [seed];
    visited.add(seed.id);

    for (let j = i + 1; j < allImages.length; j++) {
      const candidate = allImages[j];
      if (visited.has(candidate.id)) continue;

      const sim = cosineSimilarity(seed.analysis.embedding!, candidate.analysis.embedding!);
      if (sim >= CURATION_CONFIG.similarityThreshold) {
        cluster.push(candidate);
        visited.add(candidate.id);
      }
    }

    if (cluster.length > 1) {
      const group = evaluateGroup(cluster);
      // Calculate min similarity to seed for stats
      let minSim = 1.0;
      for (const p of cluster) {
        if (p.id !== seed.id) {
          const s = cosineSimilarity(seed.analysis.embedding!, p.analysis.embedding!);
          if (s < minSim) minSim = s;
        }
      }
      group.similarity = minSim;
      groups.push(group);
    }
  }

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

  // Reorder analysis keys so aestheticScore appears first in updated manifest
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

  // Save via Repository
  await saveImagesManifest(dataDir, manifest);
  console.log(`Updated manifest saved to ${dataDir}/images.manifest.json`);

  await saveCurationManifest(dataDir, result);
  console.log(`Analysis complete. Found ${result.stats.totalGroups} groups.`);
  console.log(`Results saved to ${dataDir}/curation.manifest.json`);
}

main();
