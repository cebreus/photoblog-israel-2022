/**
 * Manifest Validator
 *
 * Cross-validates all split manifests to ensure consistency.
 * Removes orphaned entries from analysis, embeddings, faces, and people manifests
 * that reference non-existent images.
 */

import type {
  AnalysisManifest,
  EmbeddingsManifest,
  FacesManifest,
  ImageEntry,
  Manifest,
  PeopleManifest,
} from "$shared/types/manifest";
import { createLogger } from "../core/cli-logger";
import { cleanOrphanedAssets } from "../gallery/cleanup";
import {
  loadAnalysisManifest,
  loadEmbeddingsManifest,
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveAnalysisManifest,
  saveEmbeddingsManifest,
  saveFacesManifest,
  savePeopleManifest,
} from "./repository";

const logger = createLogger("manifest-validator");

/**
 * Extract all valid image IDs from the main images manifest
 */
function getAllImageIds(manifest: Manifest | null): Set<string> {
  const ids = new Set<string>();
  if (!manifest) return ids;

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type !== "separator") {
        ids.add((item as ImageEntry).id);
      }
    }
  }
  return ids;
}

/**
 * Clean orphaned entries from analysis manifest
 */
function cleanAnalysisManifest(
  analysis: AnalysisManifest | null,
  validIds: Set<string>,
): { cleaned: number; manifest: AnalysisManifest } {
  if (!analysis) return { cleaned: 0, manifest: {} };

  let cleaned = 0;
  const result: AnalysisManifest = {};

  for (const [id, entry] of Object.entries(analysis)) {
    if (validIds.has(id)) {
      result[id] = entry;
    } else {
      cleaned++;
    }
  }

  return { cleaned, manifest: result };
}

/**
 * Clean orphaned entries from embeddings manifest
 */
function cleanEmbeddingsManifest(
  embeddings: EmbeddingsManifest | null,
  validIds: Set<string>,
): { cleaned: number; manifest: EmbeddingsManifest } {
  if (!embeddings) return { cleaned: 0, manifest: {} };

  let cleaned = 0;
  const result: EmbeddingsManifest = {};

  for (const [id, entry] of Object.entries(embeddings)) {
    if (validIds.has(id)) {
      result[id] = entry;
    } else {
      cleaned++;
    }
  }

  return { cleaned, manifest: result };
}

/**
 * Clean orphaned entries from faces manifest
 */
function cleanFacesManifest(
  faces: FacesManifest | null,
  validIds: Set<string>,
): { cleaned: number; manifest: FacesManifest } {
  if (!faces) return { cleaned: 0, manifest: {} };

  let cleaned = 0;
  const result: FacesManifest = {};

  for (const [id, entry] of Object.entries(faces)) {
    if (validIds.has(id)) {
      result[id] = entry;
    } else {
      cleaned++;
    }
  }

  return { cleaned, manifest: result };
}

/**
 * Clean orphaned references from people manifest
 */
function cleanPeopleManifest(
  people: PeopleManifest | null,
  validIds: Set<string>,
  validFacesManifest: FacesManifest,
): { cleaned: number; manifest: PeopleManifest } {
  if (!people) return { cleaned: 0, manifest: { people: [] } };

  let cleaned = 0;
  const result: PeopleManifest = { people: [] };

  // Build a set of valid person-to-image mappings from faces manifest
  const validPersonImageMappings = new Set<string>();
  for (const [imageId, faceEntry] of Object.entries(validFacesManifest)) {
    for (const personId of faceEntry.peopleIds || []) {
      validPersonImageMappings.add(`${personId}:${imageId}`);
    }
  }

  for (const person of people.people) {
    // Clean manualImageIds - remove references to non-existent images
    if (person.manualImageIds) {
      const originalCount = person.manualImageIds.length;
      person.manualImageIds = person.manualImageIds.filter((id) => validIds.has(id));
      cleaned += originalCount - person.manualImageIds.length;
    }

    // Check if person still has any valid references
    const hasValidReferences =
      (person.manualImageIds && person.manualImageIds.length > 0) ||
      [...validPersonImageMappings].some((mapping) => mapping.startsWith(`${person.id}:`));

    // Keep person if:
    // 1. Has valid face descriptor (can be matched in future)
    // 2. Has valid references
    // 3. Has faceCount > 0 (was matched before)
    // 4. Is marked as junk (explicit user decision)
    const hasValidDescriptor =
      (person.faceDescriptor && person.faceDescriptor.length > 0) ||
      (person.clusters && person.clusters.length > 0);

    if (hasValidDescriptor || hasValidReferences || person.faceCount > 0 || person.junk) {
      result.people.push(person);
    } else {
      cleaned++;
      logger.verbose(`Removing orphaned person: ${person.name} (${person.id})`);
    }
  }

  return { cleaned, manifest: result };
}

export interface ValidationResult {
  analysisCleanedCount: number;
  embeddingsCleanedCount: number;
  facesCleanedCount: number;
  peopleCleanedCount: number;
  orphanAssetsCleanedCount: number;
  orphanOutputsCleanedCount: number;
  totalCleaned: number;
}

/**
 * Validate and clean all split manifests for consistency.
 * Removes orphaned entries that reference non-existent images.
 *
 * @param dataDir - Path to the data directory containing manifests
 * @param dryRun - If true, only report what would be cleaned without saving
 * @param cleanOutputs - If true, also clean orphaned output files (previews, details, etc.)
 * @returns Validation result with counts of cleaned entries
 */
export async function validateAndCleanManifests(
  dataDir: string,
  dryRun = false,
  cleanOutputs = false,
): Promise<ValidationResult> {
  logger.info("Starting manifest validation...");

  // Load all manifests
  const imagesManifest = await loadImagesManifest(dataDir);
  const analysisManifest = await loadAnalysisManifest(dataDir);
  const embeddingsManifest = await loadEmbeddingsManifest(dataDir);
  const facesManifest = await loadFacesManifest(dataDir);
  const peopleManifest = await loadPeopleManifest(dataDir);

  if (!imagesManifest) {
    logger.warn("No images manifest found, skipping validation.");
    return {
      analysisCleanedCount: 0,
      embeddingsCleanedCount: 0,
      facesCleanedCount: 0,
      peopleCleanedCount: 0,
      orphanAssetsCleanedCount: 0,
      orphanOutputsCleanedCount: 0,
      totalCleaned: 0,
    };
  }

  // Get valid image IDs
  const validIds = getAllImageIds(imagesManifest);
  logger.info(`Found ${validIds.size} valid images in manifest.`);

  // Clean each manifest
  const analysisResult = cleanAnalysisManifest(analysisManifest, validIds);
  const embeddingsResult = cleanEmbeddingsManifest(embeddingsManifest, validIds);
  const facesResult = cleanFacesManifest(facesManifest, validIds);
  const peopleResult = cleanPeopleManifest(peopleManifest, validIds, facesResult.manifest);

  const totalCleaned =
    analysisResult.cleaned + embeddingsResult.cleaned + facesResult.cleaned + peopleResult.cleaned;

  if (totalCleaned > 0) {
    logger.warn(`Found ${totalCleaned} orphaned manifest entries:`);
    if (analysisResult.cleaned > 0) {
      logger.warn(`  - Analysis: ${analysisResult.cleaned} entries`);
    }
    if (embeddingsResult.cleaned > 0) {
      logger.warn(`  - Embeddings: ${embeddingsResult.cleaned} entries`);
    }
    if (facesResult.cleaned > 0) {
      logger.warn(`  - Faces: ${facesResult.cleaned} entries`);
    }
    if (peopleResult.cleaned > 0) {
      logger.warn(`  - People: ${peopleResult.cleaned} entries/references`);
    }

    if (!dryRun) {
      logger.info("Saving cleaned manifests...");
      await Promise.all([
        analysisResult.cleaned > 0 ? saveAnalysisManifest(dataDir, analysisResult.manifest) : null,
        embeddingsResult.cleaned > 0
          ? saveEmbeddingsManifest(dataDir, embeddingsResult.manifest)
          : null,
        facesResult.cleaned > 0 ? saveFacesManifest(dataDir, facesResult.manifest) : null,
        peopleResult.cleaned > 0 ? savePeopleManifest(dataDir, peopleResult.manifest) : null,
      ]);
      logger.info("Manifests cleaned successfully.");
    } else {
      logger.info("Dry run - no changes saved.");
    }
  } else {
    logger.info("All manifests are consistent. No cleanup needed.");
  }

  // Extract gallery name from dataDir (e.g., "src/data/egypt-2025" -> "egypt-2025")
  const galleryMatch = dataDir.match(/src\/data\/([^/]+)/);
  const gallery = galleryMatch?.[1];

  // Clean orphaned assets (face crops for deleted people/images)
  let orphanAssetsCleanedCount = 0;
  if (!dryRun && gallery) {
    const validPersonIds = new Set(peopleResult.manifest.people.map((p) => p.id));
    const orphanResult = await cleanOrphanedAssets(gallery, validPersonIds, validIds, dryRun);
    orphanAssetsCleanedCount = orphanResult.faceCropsRemoved + orphanResult.foldersRemoved;
  }

  // Clean orphaned output files (previews, details, etc.)
  let orphanOutputsCleanedCount = 0;
  if (cleanOutputs && gallery) {
    const projectRoot = process.cwd();
    const outputRoot = `${projectRoot}/static/${gallery}/images`;

    // Import config dynamically to avoid circular imports
    const { config } = await import("../../build.config");
    const outputFolders = getOutputFolders(config);

    // Get valid base names from images
    const validBaseNames = new Set<string>();
    for (const id of validIds) {
      // Image IDs usually match base names
      validBaseNames.add(id);
    }

    const orphanOutputs = await findOrphanAssets(outputRoot, outputFolders, validBaseNames);

    if (orphanOutputs.length > 0) {
      logger.warn(`Found ${orphanOutputs.length} orphaned output files.`);

      if (!dryRun) {
        const fsp = await import("node:fs/promises");
        const path = await import("node:path");

        for (const orphan of orphanOutputs) {
          try {
            await fsp.unlink(path.join(outputRoot, orphan));
            orphanOutputsCleanedCount++;
            logger.verbose(`Removed orphan output: ${orphan}`);
          } catch {
            // Ignore errors
          }
        }

        if (orphanOutputsCleanedCount > 0) {
          logger.info(`Cleaned ${orphanOutputsCleanedCount} orphaned output files.`);
        }
      } else {
        logger.info(`[DRY RUN] Would remove ${orphanOutputs.length} orphaned output files.`);
        orphanOutputsCleanedCount = orphanOutputs.length;
      }
    }
  }

  return {
    analysisCleanedCount: analysisResult.cleaned,
    embeddingsCleanedCount: embeddingsResult.cleaned,
    facesCleanedCount: facesResult.cleaned,
    peopleCleanedCount: peopleResult.cleaned,
    orphanAssetsCleanedCount,
    orphanOutputsCleanedCount,
    totalCleaned: totalCleaned + orphanAssetsCleanedCount + orphanOutputsCleanedCount,
  };
}
