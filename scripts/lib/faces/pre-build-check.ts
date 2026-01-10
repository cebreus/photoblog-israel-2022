/**
 * Pre-build Consistency Checker
 *
 * Quick checks to run before face clustering to detect potential issues.
 * Warns about inconsistencies without blocking the build.
 */

import path from "node:path";
import type { PeopleManifest } from "$shared/types/manifest";
import { createLogger } from "$scripts/core/cli-logger";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
} from "$scripts/manifests/repository";
import { fileExists, readFileText } from "$scripts/utils/runtime";

const logger = createLogger("pre-build-check");

export interface ConsistencyIssue {
  type: "warning" | "error";
  category: string;
  message: string;
  details?: string[];
}

export interface ConsistencyCheckResult {
  issues: ConsistencyIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * Check constraints file for stale person references
 */
async function checkConstraintsConsistency(
  dataDir: string,
  peopleManifest: PeopleManifest | null,
  issues: ConsistencyIssue[],
): Promise<void> {
  if (!peopleManifest?.people) return;

  const constraintsPath = path.join(dataDir, "clustering-constraints.json");
  if (!(await fileExists(constraintsPath))) return;

  const content = await readFileText(constraintsPath);
  const constraints = JSON.parse(content);

  if (!constraints.disconnects) return;

  const validPersonIds = new Set(peopleManifest.people.map((p) => p.id));
  const staleDisconnects = constraints.disconnects.filter(
    (d: { personId: string }) => !validPersonIds.has(d.personId),
  );

  if (staleDisconnects.length > 0) {
    issues.push({
      type: "warning",
      category: "constraints",
      message: `${staleDisconnects.length} disconnect rule(s) reference deleted persons`,
    });
  }
}

/**
 * Run pre-build consistency checks
 */
export async function runPreBuildChecks(dataDir: string): Promise<ConsistencyCheckResult> {
  const issues: ConsistencyIssue[] = [];

  logger.info({}, "Running pre-build consistency checks...");

  // Load manifests
  const imagesManifest = await loadImagesManifest(dataDir);
  const peopleManifest = await loadPeopleManifest(dataDir);
  const facesManifest = await loadFacesManifest(dataDir);

  if (!imagesManifest) {
    issues.push({
      type: "warning",
      category: "manifests",
      message: "No images manifest found - this may be a fresh gallery",
    });
    return { issues, hasErrors: false, hasWarnings: true };
  }

  // Get all valid image IDs
  const validImageIds = new Set<string>();
  for (const day of imagesManifest.photoDays || []) {
    for (const item of day.items || []) {
      if (item.type === "separator") continue;
      validImageIds.add(item.id);
    }
  }

  // Check 1: People with zero face count but have thumbnails
  if (peopleManifest?.people) {
    const zombiePeople = peopleManifest.people.filter(
      (p) => p.faceCount === 0 && p.thumbnail && !p.junk,
    );

    if (zombiePeople.length > 0) {
      issues.push({
        type: "warning",
        category: "people",
        message: `${zombiePeople.length} person(s) have faceCount=0 but have thumbnails`,
        details: zombiePeople.slice(0, 5).map((p) => `${p.name} (${p.id})`),
      });
    }
  }

  // Check 3: Faces manifest references non-existent images
  if (facesManifest) {
    const orphanFaceEntries = Object.keys(facesManifest).filter((id) => !validImageIds.has(id));
    if (orphanFaceEntries.length > 0) {
      issues.push({
        type: "warning",
        category: "faces",
        message: `${orphanFaceEntries.length} face entries reference non-existent images`,
        details: orphanFaceEntries.slice(0, 5),
      });
    }
  }

  // Check 4: Stale person references in constraints
  await checkConstraintsConsistency(dataDir, peopleManifest, issues);

  // Report results
  const hasErrors = issues.some((i) => i.type === "error");
  const hasWarnings = issues.some((i) => i.type === "warning");

  if (issues.length === 0) {
    logger.info({}, "✅ All pre-build checks passed.");
  } else {
    for (const issue of issues) {
      const prefix = issue.type === "error" ? "❌" : "⚠️";
      logger.warn(
        { category: issue.category, type: issue.type, details: issue.details },
        `${prefix} [${issue.category}] ${issue.message}`,
      );
    }
  }

  return { issues, hasErrors, hasWarnings };
}
