/**
 * Shared utilities for person normalization scripts.
 * Eliminates duplication across normalize-person-names, normalize-named-people,
 * normalize-by-category, and fix-person-format scripts.
 */

import { updatePersonReferences } from "$scripts/faces/people";
import { backupManifests, restoreManifests } from "$scripts/gallery/migration";
import {
  loadClusteringConstraints,
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveClusteringConstraints,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "$scripts/manifests/repository";
import { logResourceUsage } from "$scripts/utils/performance";
import { fileExists, rename } from "$scripts/utils/runtime";
import type {
  ClusteringConstraints,
  FacesManifest,
  Manifest,
  PeopleManifest,
  Person,
} from "$shared/types/manifest";
import path from "node:path";

export interface Manifests {
  people: PeopleManifest;
  images: Manifest;
  faces: FacesManifest;
  constraints: ClusteringConstraints;
}

export interface RenameOperation {
  person: Person;
  oldId: string;
  newId: string;
  newName?: string;
}

/**
 * Extract hash from any person ID format.
 * Examples:
 * - "person-9b0bc40f" → "9b0bc40f"
 * - "osoba-001-70767217" → "70767217"
 * - "jaruska-9b0bc40f" → "9b0bc40f"
 */
export function extractHash(id: string): string {
  // Try standard hash at end, optionally followed by dash
  const match = id.match(/-([a-f0-9]{8})(-|$)/);
  return match ? match[1] : "";
}

/**
 * Check if a name represents a generic/unnamed person.
 */
export function isGenericName(name: string): boolean {
  if (/^Person \d+$/i.test(name)) return true;
  if (/^Statue \d+$/i.test(name)) return true;
  if (/^Painting \d+$/i.test(name)) return true;
  if (name.startsWith("Odpojeno od ")) return true;
  return false;
}

/**
 * Load all required manifests for person normalization.
 */
export async function loadManifestsForNormalization(dataDir: string): Promise<Manifests | null> {
  const people = await loadPeopleManifest(dataDir);
  const images = await loadImagesManifest(dataDir);
  const faces = await loadFacesManifest(dataDir);
  const constraints = await loadClusteringConstraints(dataDir);

  if (!people || !images || !faces || !constraints) {
    return null;
  }

  return { people, images, faces, constraints };
}

/**
 * Save all manifests after normalization.
 */
export async function saveManifestsAfterNormalization(
  dataDir: string,
  manifests: Manifests,
  spinner: any,
): Promise<void> {
  spinner.start("Saving manifests...");
  await savePeopleManifest(dataDir, manifests.people);
  await saveImagesManifest(dataDir, manifests.images);
  await saveFacesManifest(dataDir, manifests.faces);
  await saveClusteringConstraints(dataDir, manifests.constraints);
  spinner.stop("Manifests saved.");
}

/**
 * Rename a single person across all manifests and filesystem.
 */
export async function renamePerson(
  operation: RenameOperation,
  manifests: Manifests,
  facesDir: string,
): Promise<void> {
  const { person, oldId, newId, newName } = operation;

  // 1. Physical folder move
  const oldPath = path.join(facesDir, oldId);
  const newPath = path.join(facesDir, newId);

  if (await fileExists(oldPath)) {
    await rename(oldPath, newPath);
  }

  // 2. Update person manifest
  person.id = newId;
  if (newName !== undefined) {
    person.name = newName;
  }

  // Update thumbnail only if it's in faces/ folder (not avatars)
  if (person.thumbnail?.includes(`faces/${oldId}/`)) {
    person.thumbnail = person.thumbnail.replace(oldId, newId);
  }

  // 3. Update references in images and faces manifests
  updatePersonReferences(manifests.images, manifests.faces, oldId, newId);

  // 4. Update clustering constraints
  for (const c of manifests.constraints.connects) {
    if (c.personId === oldId) c.personId = newId;
  }
  for (const c of manifests.constraints.disconnects) {
    if (c.personId === oldId) c.personId = newId;
  }
}

/**
 * Batch rename multiple people with automatic backup/restore.
 */
export async function batchRenamePeople(params: {
  manifests: Manifests;
  operations: RenameOperation[];
  gallery: string;
  dataDir: string;
  facesDir: string;
  spinner: any;
}): Promise<number> {
  const { manifests, operations, gallery, dataDir, facesDir, spinner } = params;

  async function execute(): Promise<number> {
    // Manifests are passed in, no need to load

    // Create backup
    spinner.start("Creating backup...");
    const backupDir = await backupManifests(gallery);
    spinner.stop("Backup created.");

    let processed = 0;

    try {
      // Execute all rename operations
      for (const operation of operations) {
        await renamePerson(operation, manifests, facesDir);
        processed++;
        if (processed % 100 === 0) {
          logResourceUsage(`normalize-progress-${processed}`);
        }
      }

      // Save manifests
      await saveManifestsAfterNormalization(dataDir, manifests, spinner);

      return processed;
    } catch (err) {
      // Restore from backup on error
      if (backupDir) {
        spinner.start("Error occurred, restoring backup...");
        await restoreManifests(gallery, backupDir);
        spinner.stop("Backup restored.");
      }
      throw err;
    }
  }

  // Execute directly (caller handles locking)
  return await execute();
}
