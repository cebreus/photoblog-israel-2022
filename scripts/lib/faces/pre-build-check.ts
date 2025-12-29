/**
 * Pre-build Consistency Checker
 *
 * Quick checks to run before face clustering to detect potential issues.
 * Warns about inconsistencies without blocking the build.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../core/cli-logger";
import { loadFacesManifest, loadImagesManifest, loadPeopleManifest } from "../manifests/repository";

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
 * Run pre-build consistency checks
 */
export async function runPreBuildChecks(dataDir: string): Promise<ConsistencyCheckResult> {
  const issues: ConsistencyIssue[] = [];

  logger.info("Running pre-build consistency checks...");

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
      if (item.type !== "separator") {
        validImageIds.add(item.id);
      }
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

    // Check 2: People without valid descriptors
    const noDescriptor = peopleManifest.people.filter(
      (p) =>
        !p.junk &&
        (!p.faceDescriptor || p.faceDescriptor.length === 0) &&
        (!p.clusters || p.clusters.length === 0),
    );
    if (noDescriptor.length > 0) {
      issues.push({
        type: "warning",
        category: "people",
        message: `${noDescriptor.length} person(s) have no valid face descriptors`,
        details: noDescriptor.slice(0, 5).map((p) => `${p.name} (${p.id})`),
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

  // Check 4: Constraints file exists and is valid
  const constraintsPath = path.join(dataDir, "clustering-constraints.json");
  try {
    const content = await fsp.readFile(constraintsPath, "utf-8");
    const constraints = JSON.parse(content);

    // Check for stale person references in constraints
    if (peopleManifest?.people && constraints.disconnects) {
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
  } catch {
    // No constraints file is fine
  }

  // Report results
  const hasErrors = issues.some((i) => i.type === "error");
  const hasWarnings = issues.some((i) => i.type === "warning");

  if (issues.length === 0) {
    logger.info("✅ All pre-build checks passed.");
  } else {
    for (const issue of issues) {
      const prefix = issue.type === "error" ? "❌" : "⚠️";
      logger.warn(`${prefix} [${issue.category}] ${issue.message}`);
      if (issue.details) {
        for (const detail of issue.details) {
          logger.warn(`   - ${detail}`);
        }
        const match = issue.message.match(/\d+/);
        const totalCount = match ? parseInt(match[0], 10) : 0;
        if (issue.details.length < totalCount) {
          logger.warn("   ... and more");
        }
      }
    }
  }

  return { issues, hasErrors, hasWarnings };
}
