/**
 * @fileoverview Garbage collection for clustering constraints.
 *
 * @description
 * Removes invalid constraints referencing non-existent images or people.
 */
import type { Logger } from "$scripts/core/cli-logger";
import {
  loadClusteringConstraints,
  loadImagesManifest,
  loadPeopleManifest,
  saveClusteringConstraints,
} from "$scripts/manifests/repository";
import type { ClusteringConstraints } from "../../../src/lib/types/manifest";

/**
 * Clean up invalid constraints (referencing non-existent people or images).
 * Run this periodically or after major refactors.
 */
export async function gcConstraints(
  dataDir: string,
  log: Logger,
): Promise<{ removedConnects: number; removedDisconnects: number }> {
  log.info({}, "Starting constraints garbage collection...");

  const constraints = await loadClusteringConstraints(dataDir, log);
  if (!constraints) {
    log.info({}, "No constraints file found, skipping GC.");
    return { removedConnects: 0, removedDisconnects: 0 };
  }

  const peopleManifest = await loadPeopleManifest(dataDir, log);
  const imagesManifest = await loadImagesManifest(dataDir, log);

  if (!peopleManifest || !imagesManifest) {
    log.error({}, "Failed to load manifests for constraints GC");
    throw new Error("Missing manifests");
  }

  const validPeopleIds = new Set(peopleManifest.people.map((p) => p.id));
  const validImageIds = new Set<string>();

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      validImageIds.add(item.id);
    }
  }

  let removedConnects = 0;
  let removedDisconnects = 0;

  // Filter Connects
  const newConnects = constraints.connects.filter((c) => {
    const validP = validPeopleIds.has(c.personId);
    const validI = validImageIds.has(c.imageId);
    if (!validP || !validI) {
      removedConnects++;
      return false;
    }
    return true;
  });

  // Filter Disconnects
  const newDisconnects = constraints.disconnects.filter((c) => {
    const validP = validPeopleIds.has(c.personId);
    const validI = validImageIds.has(c.imageId);
    if (!validP || !validI) {
      removedDisconnects++;
      return false;
    }
    return true;
  });

  if (removedConnects > 0 || removedDisconnects > 0) {
    log.info({ removedConnects, removedDisconnects }, "Found and removed invalid constraints");

    const newConstraints: ClusteringConstraints = {
      ...constraints,
      connects: newConnects,
      disconnects: newDisconnects,
    };

    await saveClusteringConstraints(dataDir, newConstraints, log);
  } else {
    log.info({}, "Constraints are clean, no changes needed.");
  }

  return { removedConnects, removedDisconnects };
}
