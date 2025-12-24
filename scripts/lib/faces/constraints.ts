/**
 * @fileoverview Constraint Utilities
 *
 * Shared utilities for managing clustering constraints.
 * Used by reassign, unmatch, invalidate-detection, and merge endpoints.
 */

import { loadClusteringConstraints, saveClusteringConstraints } from "../manifests/repository";

export type Constraint = {
  imageId: string;
  personId: string;
};

export type ClusteringConstraints = {
  disconnects: Constraint[];
  connects: Constraint[];
  invalidDetections?: Array<{
    imageId: string;
    box: { x: number; y: number; width: number; height: number };
  }>;
};

/**
 * Adds disconnect and connect constraints for a reassignment.
 * Automatically deduplicates entries.
 */
export async function addReassignmentConstraints(
  dataDir: string,
  imageIds: string[],
  oldPersonId: string,
  newPersonId: string,
): Promise<void> {
  let constraints = await loadClusteringConstraints(dataDir);
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

  await saveClusteringConstraints(dataDir, constraints);
}

/**
 * Updates all constraints referencing oldPersonId to use newPersonId.
 * Used during person rename/merge operations.
 */
export async function migratePersonInConstraints(
  dataDir: string,
  oldPersonId: string,
  newPersonId: string,
): Promise<boolean> {
  const constraints = await loadClusteringConstraints(dataDir);
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
    await saveClusteringConstraints(dataDir, constraints);
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
