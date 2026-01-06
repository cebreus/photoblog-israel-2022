/**
 * Manifest Validator
 *
 * Cross-validates all split manifests to ensure consistency.
 * Removes orphaned entries from analysis, embeddings, faces, and people manifests
 * that reference non-existent images.
 * Also handles physical file consistency (phantom assignments/thumbnails).
 */

import path from "node:path";
import type {
  AnalysisManifest,
  EmbeddingsManifest,
  FacesManifest,
  ImageEntry,
  ImageFaces,
  Manifest,
  PeopleManifest,
  Person,
} from "$shared/types/manifest";
import { createLogger } from "../core/cli-logger";
import { cleanOrphanedAssets, findOrphanAssets, getOutputFolders } from "../gallery/cleanup";
import {
  loadAnalysisManifest,
  loadEmbeddingsManifest,
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveAnalysisManifest,
  saveEmbeddingsManifest,
  saveFacesManifest,
  saveImagesManifest,
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
  for (const [imageId, faceEntry] of Object.entries(validFacesManifest) as [string, any][]) {
    for (const personId of faceEntry.peopleIds || []) {
      validPersonImageMappings.add(`${personId}:${imageId}`);
    }
  }

  const seenIds = new Set<string>();

  for (const person of people.people) {
    if (seenIds.has(person.id)) {
      cleaned++;
      continue;
    }
    seenIds.add(person.id);
    // Clean manualImageIds - remove references to non-existent images
    if (person.manualImageIds) {
      const originalCount = person.manualImageIds.length;
      person.manualImageIds = person.manualImageIds.filter((id: string) => validIds.has(id));
      cleaned += originalCount - person.manualImageIds.length;
    }

    // Check if person still has any valid references
    const hasValidReferences =
      (person.manualImageIds && person.manualImageIds.length > 0) ||
      [...validPersonImageMappings].some((mapping) => mapping.startsWith(`${person.id}:`));

    // Keep person if:
    // 1. Has valid references (manual or auto)
    // 2. Has faceCount > 0 (was matched before)

    // Strictly remove people with no photos, even if they have a descriptor.
    // Also remove 'junk' people if they have no photos (useless without visual).
    if (hasValidReferences || person.faceCount > 0) {
      result.people.push(person);
    } else {
      cleaned++;
      logger.verbose(`Removing orphaned person: ${person.name} (${person.id})`);
    }
  }

  return { cleaned, manifest: result };
}

/**
 * Removes person assignments from images.manifest.json where no corresponding face crop exists on disk.
 */
async function cleanPhantomAssignments(
  gallery: string,
  imagesManifest: Manifest,
  facesManifest: FacesManifest | null,
): Promise<{ totalRemoved: number; facesRemoved: number }> {
  const facesDir = path.resolve(process.cwd(), "static", gallery, "faces");

  let totalRemoved = 0;
  let facesRemoved = 0;

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      // Process all items that have people assignments, regardless of type (image, collage, etc.)
      if (item.type === "separator" || !item.people || item.people.length === 0) {
        continue;
      }

      const validPeople: string[] = [];

      for (const personId of item.people) {
        const cropPath = path.join(facesDir, personId, `${item.id}.jpg`);
        const exists = await Bun.file(cropPath).exists();

        if (exists) {
          validPeople.push(personId);
        } else {
          logger.warn(
            { personId, imageId: item.id },
            "Removing phantom: Assignment removed (crop missing)",
          );
          totalRemoved++;

          // Also remove from faces manifest if present
          if (facesManifest?.[item.id]?.peopleIds) {
            const idx = facesManifest[item.id].peopleIds.indexOf(personId);
            if (idx !== -1) {
              facesManifest[item.id].peopleIds.splice(idx, 1);
              facesRemoved++;
            }
          }
        }
      }

      if (validPeople.length === 0) {
        delete item.people;
      } else {
        item.people = validPeople;
      }
    }
  }

  return { totalRemoved, facesRemoved };
}

/**
 * Clean people.manifest.json:
 * Removes 'thumbnail' property if the file does not exist on disk.
 */
async function cleanPhantomPeopleThumbnails(
  gallery: string,
  peopleManifest: PeopleManifest,
): Promise<{ cleanedThumbnails: number }> {
  const staticDir = path.resolve(process.cwd(), "static", gallery);
  let cleanedThumbnails = 0;

  for (const person of peopleManifest.people) {
    if (person.thumbnail) {
      let thumbPath = person.thumbnail;
      if (thumbPath.startsWith("/")) {
        const relPath = thumbPath.replace(/^\/[^/]+\//, "");
        thumbPath = path.join(staticDir, relPath);
      } else {
        thumbPath = path.join(staticDir, person.thumbnail);
      }

      const exists = await Bun.file(thumbPath).exists();
      if (!exists) {
        logger.warn(
          { personId: person.id, thumbnail: person.thumbnail },
          "Removing phantom thumbnail from person",
        );
        person.thumbnail = "";
        cleanedThumbnails++;
      }
    }
  }

  return { cleanedThumbnails };
}

/**
 * Recalculate face counts in people.manifest.json based on faces.manifest.json data.
 */
async function recalculatePeopleStats(
  peopleManifest: PeopleManifest,
  facesManifest: FacesManifest,
): Promise<{ statsUpdated: number }> {
  const counts = new Map<string, number>();

  // Count actual references
  for (const entry of Object.values(facesManifest) as ImageFaces[]) {
    if (entry.peopleIds) {
      for (const pid of entry.peopleIds) {
        counts.set(pid, (counts.get(pid) || 0) + 1);
      }
    }
  }

  let statsUpdated = 0;

  for (const person of peopleManifest.people) {
    const newCount = counts.get(person.id) || 0;
    if (person.faceCount !== newCount) {
      person.faceCount = newCount;
      statsUpdated++;
    }
  }

  return { statsUpdated };
}

export interface ValidationResult {
  analysisCleanedCount: number;
  embeddingsCleanedCount: number;
  facesCleanedCount: number;
  peopleCleanedCount: number;
  orphanAssetsCleanedCount: number;
  orphanOutputsCleanedCount: number;
  phantomAssignmentsRemoved: number;
  phantomThumbnailsCleaned: number;
  peopleStatsUpdated: number;
  totalCleaned: number;
}

/**
 * Validate and clean all split manifests for consistency.
 * Removes orphaned entries that reference non-existent images.
 * Also cleans phantom assignments and updates people stats.
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
  logger.info({}, "Starting manifest validation...");

  // Extract gallery name from dataDir (e.g., "src/data/egypt-2025" -> "egypt-2025")
  const galleryMatch = dataDir.match(/src\/data\/([^/]+)/);
  const gallery = galleryMatch?.[1];

  if (!gallery) {
    logger.warn({}, "Could not determine gallery name from dataDir, skipping phantom cleanup.");
  }

  // Load all manifests
  const imagesManifest = await loadImagesManifest(dataDir);
  const analysisManifest = await loadAnalysisManifest(dataDir);
  const embeddingsManifest = await loadEmbeddingsManifest(dataDir);
  const facesManifest = await loadFacesManifest(dataDir);
  const peopleManifest = await loadPeopleManifest(dataDir);

  if (!imagesManifest) {
    logger.warn({}, "No images manifest found, skipping validation.");
    return {
      analysisCleanedCount: 0,
      embeddingsCleanedCount: 0,
      facesCleanedCount: 0,
      peopleCleanedCount: 0,
      orphanAssetsCleanedCount: 0,
      orphanOutputsCleanedCount: 0,
      phantomAssignmentsRemoved: 0,
      phantomThumbnailsCleaned: 0,
      peopleStatsUpdated: 0,
      totalCleaned: 0,
    };
  }

  // 1. Phantom Cleanup (Files -> Manifests)
  // We do this BEFORE manifest verification, and we do it in-place
  let phantomAssignmentsRemoved = 0;
  let phantomThumbnailsCleaned = 0;

  if (gallery && !dryRun) {
    // Clean assignments (updates imagesManifest and facesManifest in place)
    const assignResult = await cleanPhantomAssignments(gallery, imagesManifest, facesManifest);
    phantomAssignmentsRemoved = assignResult.totalRemoved;
    if (phantomAssignmentsRemoved > 0) {
      logger.info({ removed: phantomAssignmentsRemoved }, "Cleaned phantom assignments");
    }

    // Clean thumbnails (updates peopleManifest in place)
    if (peopleManifest) {
      const thumbResult = await cleanPhantomPeopleThumbnails(gallery, peopleManifest);
      phantomThumbnailsCleaned = thumbResult.cleanedThumbnails;
      if (phantomThumbnailsCleaned > 0) {
        logger.info({ cleaned: phantomThumbnailsCleaned }, "Cleaned phantom people thumbnails");
      }
    }
  }

  // 2. Cross-Manifest Validation (Manifest -> Manifest)
  // Get valid image IDs (now that imagesManifest is cleaned of phantom assignments)
  const validIds = getAllImageIds(imagesManifest);
  logger.info({ count: validIds.size }, "Found valid images in manifest");

  // Clean each manifest (orphans)
  const analysisResult = cleanAnalysisManifest(analysisManifest, validIds);
  const embeddingsResult = cleanEmbeddingsManifest(embeddingsManifest, validIds);
  const facesResult = cleanFacesManifest(facesManifest, validIds);

  // 3. Recalculate People Stats
  // Must happen BEFORE cleanPeopleManifest so faceCount is accurate for filtering
  let peopleStatsUpdated = 0;
  if (peopleManifest && !dryRun) {
    // Using facesResult.manifest (which is facesManifest filtered by valid images)
    const statsRes = await recalculatePeopleStats(peopleManifest, facesResult.manifest);
    peopleStatsUpdated = statsRes.statsUpdated;
    if (peopleStatsUpdated > 0) {
      logger.info({ updated: peopleStatsUpdated }, "Updated people statistics");
    }
  }

  // 4. Clean People Manifest (orphans)
  const peopleResult = cleanPeopleManifest(peopleManifest, validIds, facesResult.manifest);

  const totalManifestCleaned =
    analysisResult.cleaned +
    embeddingsResult.cleaned +
    facesResult.cleaned +
    peopleResult.cleaned +
    phantomAssignmentsRemoved +
    phantomThumbnailsCleaned +
    peopleStatsUpdated;

  if (totalManifestCleaned > 0) {
    logger.warn({ count: totalManifestCleaned }, "Found manifest inconsistencies");
    if (phantomAssignmentsRemoved > 0)
      logger.warn({ count: phantomAssignmentsRemoved }, "Phantom Assignments");
    if (phantomThumbnailsCleaned > 0)
      logger.warn({ count: phantomThumbnailsCleaned }, "Phantom Thumbnails");
    if (peopleStatsUpdated > 0) logger.warn({ count: peopleStatsUpdated }, "People Stats Updated");
    if (analysisResult.cleaned > 0)
      logger.warn({ count: analysisResult.cleaned }, "Analysis Orphans");
    if (embeddingsResult.cleaned > 0)
      logger.warn({ count: embeddingsResult.cleaned }, "Embeddings Orphans");
    if (facesResult.cleaned > 0) logger.warn({ count: facesResult.cleaned }, "Faces Orphans");
    if (peopleResult.cleaned > 0) logger.warn({ count: peopleResult.cleaned }, "People Orphans");

    if (!dryRun) {
      logger.info({}, "Saving cleaned manifests...");
      // Save all manifests that might have changed
      await Promise.all([
        // Always save imagesManifest if phantoms removed (modified in place)
        phantomAssignmentsRemoved > 0 ? saveImagesManifest(dataDir, imagesManifest) : null,

        // Save analysis/embeddings if orphans removed
        analysisResult.cleaned > 0 ? saveAnalysisManifest(dataDir, analysisResult.manifest) : null,
        embeddingsResult.cleaned > 0
          ? saveEmbeddingsManifest(dataDir, embeddingsResult.manifest)
          : null,

        // Save faces if orphans removed OR phantoms removed (modified in place via cleanPhantomAssignments)
        // Note: facesResult.manifest is a NEW object with orphans removed.
        // But cleanPhantomAssignments modified the ORIGINAL facesManifest.
        // facesResult was created FROM `facesManifest` (the modified original).
        // So we should save `facesResult.manifest`.
        facesResult.cleaned > 0 || phantomAssignmentsRemoved > 0 /* assumes faces removed too */
          ? saveFacesManifest(dataDir, facesResult.manifest)
          : null,

        // Save people if orphans removed OR phantoms cleaned OR stats updated
        // peopleResult.manifest is NEW object.
        // cleanPhantomPeopleThumbnails modified `peopleManifest` (the original).
        // recalculatePeopleStats modified `peopleManifest`.
        // cleanPeopleManifest used `peopleManifest` as input.
        // So `peopleResult.manifest` CONTAINS the updates from previous steps.
        peopleResult.cleaned > 0 || phantomThumbnailsCleaned > 0 || peopleStatsUpdated > 0
          ? savePeopleManifest(dataDir, peopleResult.manifest)
          : null,
      ]);
      logger.info({}, "Manifests cleaned successfully.");
    } else {
      logger.info({}, "Dry run - no changes saved.");
    }
  } else {
    logger.info({}, "All manifests are consistent. No cleanup needed.");
  }

  // 5. Orphan Assets Cleanup (Manifest -> Files)
  let orphanAssetsCleanedCount = 0;
  if (!dryRun && gallery && peopleManifest) {
    // Use the FINAL valid people list from peopleResult
    // (We must assume peopleResult.manifest is what we're keeping)
    const validPersonIds = new Set(peopleResult.manifest.people.map((p: Person) => p.id));
    const orphanResult = await cleanOrphanedAssets(gallery, validPersonIds, validIds, dryRun);
    orphanAssetsCleanedCount = orphanResult.faceCropsRemoved + orphanResult.foldersRemoved;
  }

  // 6. Orphan Output Cleanup
  let orphanOutputsCleanedCount = 0;
  if (cleanOutputs && gallery) {
    const projectRoot = process.cwd();
    const outputRoot = `${projectRoot}/static/${gallery}/images`;

    // Import config dynamically to avoid circular imports
    const { config } = await import("../../build.config");
    const outputFolders = getOutputFolders(config as any);

    // Get valid base names from images
    const validBaseNames = new Set<string>();
    for (const id of validIds) {
      // Image IDs usually match base names
      validBaseNames.add(id);
    }

    const orphanOutputs = await findOrphanAssets(outputRoot, outputFolders, validBaseNames);

    if (orphanOutputs.length > 0) {
      logger.warn({ count: orphanOutputs.length }, "Found orphaned output files");

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
          logger.info({ count: orphanOutputsCleanedCount }, "Cleaned orphaned output files");
        }
      } else {
        logger.info(
          { count: orphanOutputs.length },
          "[DRY RUN] Would remove orphaned output files",
        );
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
    phantomAssignmentsRemoved,
    phantomThumbnailsCleaned,
    peopleStatsUpdated,
    totalCleaned: totalManifestCleaned + orphanAssetsCleanedCount + orphanOutputsCleanedCount,
  };
}
