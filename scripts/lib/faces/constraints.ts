/**
 * @fileoverview Constraint Utilities
 *
 * Shared utilities for managing clustering constraints.
 * Used by reassign, unmatch, invalidate-detection, and merge endpoints.
 */

import type { Constraint } from "$shared/types/manifest";
import { createLogger, type Logger } from "../core/cli-logger";
import { loadClusteringConstraints, saveClusteringConstraints } from "../manifests/repository";

const logger = createLogger("constraints");

/**
 * Adds disconnect and connect constraints for a reassignment.
 * Automatically deduplicates entries.
 */
export async function addReassignmentConstraints(
  dataDir: string,
  imageIds: string[],
  oldPersonId: string,
  newPersonId: string,
  log: Logger = logger,
): Promise<void> {
  let constraints = await loadClusteringConstraints(dataDir, log);
  if (!constraints) {
    constraints = { disconnects: [], connects: [] };
  }
  if (!constraints.disconnects) constraints.disconnects = [];
  if (!constraints.connects) constraints.connects = [];

  for (const imageId of imageIds) {
    constraints.disconnects.push({ imageId, personId: oldPersonId });
    constraints.connects.push({ imageId, personId: newPersonId });
  }

  constraints.disconnects = deduplicateConstraints(constraints.disconnects);
  constraints.connects = deduplicateConstraints(constraints.connects);

  await saveClusteringConstraints(dataDir, constraints, log);
}

/**
 * Updates all constraints referencing oldPersonId to use newPersonId.
 * Used during person rename/merge operations.
 */
export async function migratePersonInConstraints(
  dataDir: string,
  oldPersonId: string,
  newPersonId: string,
  log: Logger = logger,
): Promise<boolean> {
  const constraints = await loadClusteringConstraints(dataDir, log);
  if (!constraints) return false;

  let modified = false;

  const listTypes = ["disconnects", "connects"] as const;
  for (const type of listTypes) {
    const list = constraints[type];
    if (!Array.isArray(list)) continue;

    for (const entry of list) {
      if (entry.personId === oldPersonId) {
        entry.personId = newPersonId;
        modified = true;
      }
    }
  }

  if (modified) {
    // Deduplicate after migration
    constraints.disconnects = deduplicateConstraints(constraints.disconnects);
    constraints.connects = deduplicateConstraints(constraints.connects);
    await saveClusteringConstraints(dataDir, constraints, log);
  }

  return modified;
}

/**
 * Deduplicates constraint entries by imageId:personId key.
 */
export function deduplicateConstraints(constraints: Constraint[]): Constraint[] {
  const seen = new Set<string>();
  return constraints.filter(function (constraint) {
    const key = `${constraint.imageId}:${constraint.personId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
