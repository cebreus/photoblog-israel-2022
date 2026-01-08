/**
 * Content Hash Tracker
 *
 * Tracks content hashes of source images to detect renames.
 * When a file is renamed (rather than deleted+new), this allows
 * migrating all references (faces, people, manifests) instead
 * of losing the data.
 */

import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type { FacesManifest, Manifest, PeopleManifest } from "$shared/types/manifest";
import { createLogger } from "../core/cli-logger";

const logger = createLogger("content-tracker");

export interface ContentHashEntry {
  hash: string;
  lastKnownPath: string;
  lastKnownId: string;
  mtimeMs: number;
}

export interface ContentHashTracker {
  version: number;
  entries: Record<string, ContentHashEntry>; // keyed by hash
}

const TRACKER_VERSION = 1;
const TRACKER_FILENAME = "content-hashes.json";

/**
 * Compute SHA-256 hash of a file (first 64KB for performance)
 */
async function computeContentHash(filePath: string): Promise<string> {
  const handle = await fsp.open(filePath, "r");
  try {
    // Read first 64KB - enough to detect unique content while being fast
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const data = buffer.subarray(0, bytesRead);

    const hash = crypto.createHash("sha256");
    hash.update(data);
    return hash.digest("hex").slice(0, 16); // Use first 16 chars for compactness
  } finally {
    await handle.close();
  }
}

/**
 * Load content hash tracker from disk
 */
export async function loadContentTracker(cacheDir: string): Promise<ContentHashTracker> {
  const trackerPath = path.join(cacheDir, TRACKER_FILENAME);
  try {
    const content = await fsp.readFile(trackerPath, "utf-8");
    const tracker = JSON.parse(content);
    if (tracker.version !== TRACKER_VERSION) {
      logger.verbose(
        { currentVersion: tracker.version, expectedVersion: TRACKER_VERSION },
        "Content tracker version mismatch, resetting.",
      );
      return { version: TRACKER_VERSION, entries: {} };
    }
    return tracker;
  } catch {
    return { version: TRACKER_VERSION, entries: {} };
  }
}

/**
 * Save content hash tracker to disk
 */
export async function saveContentTracker(
  cacheDir: string,
  tracker: ContentHashTracker,
): Promise<void> {
  const trackerPath = path.join(cacheDir, TRACKER_FILENAME);
  await fsp.mkdir(cacheDir, { recursive: true });
  await fsp.writeFile(trackerPath, JSON.stringify(tracker, null, 2));
}

export interface RenameDetection {
  oldPath: string;
  oldId: string;
  newPath: string;
  newId: string;
  hash: string;
}

/**
 * Detect file renames by comparing content hashes
 *
 * @param sourceFiles - Current source files on disk
 * @param tracker - Content hash tracker
 * @param srcRoot - Source root directory
 * @returns List of detected renames
 */
export async function detectRenames(
  sourceFiles: string[],
  tracker: ContentHashTracker,
  srcRoot: string,
): Promise<RenameDetection[]> {
  const renames: RenameDetection[] = [];
  const currentHashes = new Map<string, string>(); // hash -> current path

  // Compute hashes for new/unknown files
  const unknownFiles: string[] = [];
  const knownPaths = new Set(Object.values(tracker.entries).map((e) => e.lastKnownPath));

  for (const file of sourceFiles) {
    const relativePath = path.relative(srcRoot, file);
    if (!knownPaths.has(relativePath)) {
      unknownFiles.push(file);
    }
  }

  // For unknown files, compute hash and check if it matches a known hash
  for (const file of unknownFiles) {
    const hash = await computeContentHash(file);
    currentHashes.set(hash, file);

    // Check if this hash exists in tracker (possible rename)
    const existingEntry = tracker.entries[hash];
    if (existingEntry) {
      const relativePath = path.relative(srcRoot, file);
      const newId = path.basename(relativePath, path.extname(relativePath));

      // This is a rename!
      renames.push({
        oldPath: existingEntry.lastKnownPath,
        oldId: existingEntry.lastKnownId,
        newPath: relativePath,
        newId,
        hash,
      });

      logger.info(
        { oldPath: existingEntry.lastKnownPath, newPath: relativePath },
        "Detected rename",
      );
    }
  }

  return renames;
}

/**
 * Update content tracker with current files
 */
export async function updateContentTracker(
  sourceFiles: string[],
  tracker: ContentHashTracker,
  srcRoot: string,
): Promise<void> {
  // Clear entries for files that no longer exist
  const currentPaths = new Set(sourceFiles.map((f) => path.relative(srcRoot, f)));
  for (const [_hash, entry] of Object.entries(tracker.entries)) {
    if (!currentPaths.has(entry.lastKnownPath)) {
      // Keep the entry for a while to detect renames
      // Only delete if very old (implement TTL if needed)
    }
  }

  // Update/add entries for current files
  for (const file of sourceFiles) {
    const relativePath = path.relative(srcRoot, file);
    const stats = await fsp.stat(file);
    const id = path.basename(relativePath, path.extname(relativePath));

    // Check if we already have this path tracked
    let foundHash: string | null = null;
    for (const [hash, entry] of Object.entries(tracker.entries)) {
      if (entry.lastKnownPath === relativePath) {
        // Update mtime if changed, rehash if needed
        if (entry.mtimeMs !== stats.mtimeMs) {
          const newHash = await computeContentHash(file);
          if (newHash !== hash) {
            // Content changed, update hash
            delete tracker.entries[hash];
            tracker.entries[newHash] = {
              hash: newHash,
              lastKnownPath: relativePath,
              lastKnownId: id,
              mtimeMs: stats.mtimeMs,
            };
          } else {
            entry.mtimeMs = stats.mtimeMs;
          }
        }
        foundHash = hash;
        break;
      }
    }

    if (!foundHash) {
      // New file, add to tracker
      const hash = await computeContentHash(file);
      tracker.entries[hash] = {
        hash,
        lastKnownPath: relativePath,
        lastKnownId: id,
        mtimeMs: stats.mtimeMs,
      };
    }
  }
}

/**
 * Migrate references when a file is renamed
 */
export function migrateReferences(
  rename: RenameDetection,
  manifest: Manifest,
  facesManifest: FacesManifest,
  peopleManifest: PeopleManifest,
): { manifestUpdated: boolean; facesUpdated: boolean; peopleUpdated: boolean } {
  let manifestUpdated = false;
  let facesUpdated = false;
  let peopleUpdated = false;

  const { oldId, newId } = rename;

  // Update images manifest
  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type !== "separator" && item.id === oldId) {
        item.id = newId;
        item.src = path.basename(rename.newPath);
        manifestUpdated = true;
      }
    }
  }

  // Update faces manifest
  if (facesManifest[oldId]) {
    facesManifest[newId] = facesManifest[oldId];
    delete facesManifest[oldId];
    facesUpdated = true;
  }

  // Update people manifest references
  for (const person of peopleManifest.people) {
    if (person.manualImageIds) {
      const idx = person.manualImageIds.indexOf(oldId);
      if (idx !== -1) {
        person.manualImageIds[idx] = newId;
        peopleUpdated = true;
      }
    }

    // Update thumbnail path if it references the old ID
    if (person.thumbnail?.includes(oldId)) {
      person.thumbnail = person.thumbnail.replace(oldId, newId);
      peopleUpdated = true;
    }
  }

  if (manifestUpdated || facesUpdated || peopleUpdated) {
    logger.info({ oldId, newId }, "Migrated references");
  }

  return { manifestUpdated, facesUpdated, peopleUpdated };
}
