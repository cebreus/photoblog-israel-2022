import fsp from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import type { ImageEntry, Manifest } from "../src/lib/types/manifest";

/**
 * Configuration for AI curation logic
 */
const CURATION_CONFIG = {
  // Cosine Similarity Threshold
  // 1.0 = identical
  // 0.95 = very similar
  // 0.90 = likely same subject/motif
  // 0.85 = usually distinct
  similarityThreshold: 0.89, // Tuned for Xenova/clip-vit-large-patch14

  preferredAuthors: ["cebreus", "professionals"],
};

type CurationRecommendation = {
  action: "keep" | "delete";
  reason: string;
};

type CurationGroup = {
  id: string;
  items: string[];
  bestCandidateId: string;
  similarity: number; // Average or min similarity in group
  recommendations: Record<string, CurationRecommendation>;
};

type CurationManifest = {
  groups: CurationGroup[];
  stats: {
    totalPhotos: number;
    totalGroups: number;
    duplicatesFound: number;
  };
};

/**
 * Calculates Cosine Similarity between two vectors
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
 * Selects the best photo from a group based on rules
 */
function evaluateGroup(photos: ImageEntry[]): CurationGroup {
  const groupId = `group-${photos[0].id}`;

  // Sort logic (descending = best first):
  // 1. Resolution
  // 2. Sharpness
  // 3. Author
  // 4. Date

  const sorted = [...photos].sort((a, b) => {
    const analysisA = a.analysis || { sharpness: 0 };
    const analysisB = b.analysis || { sharpness: 0 };

    // 1. Resolution (Higher is better)
    const areaA = (a.width || 0) * (a.height || 0);
    const areaB = (b.width || 0) * (b.height || 0);
    if (Math.abs(areaA - areaB) / Math.max(areaA, areaB) > 0.05) {
      return areaB - areaA;
    }

    // 2. Sharpness (Higher is better)
    const sharpA = analysisA.sharpness || 0;
    const sharpB = analysisB.sharpness || 0;
    if (Math.abs(sharpA - sharpB) / Math.max(sharpA, sharpB) > 0.1) {
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
      if (
        (best.width || 0) * (best.height || 0) >
        (photo.width || 0) * (photo.height || 0)
      ) {
        reasons.push("Lower resolution");
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

async function main() {
  // Determine manifest path based on usage (default or explicit)
  // We assume standard location in src/lib/data/{CONTENT_DIR}/images.manifest.json
  // But config.paths.manifest depends on config loading which might default to egypt-2025 if not set?
  // We need to support 'egypt-2025' explicitly if passed.

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  console.log(`Analyzing content for: ${contentDir}`);

  const manifestPath = path.resolve(
    process.cwd(),
    `src/lib/data/${contentDir}/images.manifest.json`,
  );
  const outPath = path.resolve(
    process.cwd(),
    `src/lib/data/${contentDir}/curation.manifest.json`,
  );

  const content = await fsp.readFile(manifestPath, "utf-8");
  const manifest: Manifest = JSON.parse(content);

  const allImages: ImageEntry[] = [];
  manifest.photoDays.forEach((day) => {
    day.items.forEach((item) => {
      if (item.type === "image" && item.analysis?.embedding) {
        allImages.push(item as ImageEntry);
      }
    });
  });

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

      const sim = cosineSimilarity(
        seed.analysis!.embedding!,
        candidate.analysis!.embedding!,
      );
      if (sim >= CURATION_CONFIG.similarityThreshold) {
        cluster.push(candidate);
        visited.add(candidate.id);
        // console.log(`  Match: ${seed.id} <-> ${candidate.id} (${sim.toFixed(4)})`);
      }
    }

    if (cluster.length > 1) {
      const group = evaluateGroup(cluster);
      // Calculate min similarity to seed for stats
      let minSim = 1.0;
      for (const p of cluster) {
        if (p.id !== seed.id) {
          const s = cosineSimilarity(
            seed.analysis!.embedding!,
            p.analysis!.embedding!,
          );
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

  await fsp.writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(`Analysis complete. Found ${result.stats.totalGroups} groups.`);
  console.log(`Results saved to ${outPath}`);
}

main();
