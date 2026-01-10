import { building, dev } from "$app/environment";
import { createLogger } from "$lib/logger";
import type { CurationManifest, Manifest, PeopleManifest } from "$lib/types/manifest";
import path from "node:path";
import {
  normalizePeople,
  reclassifyCollages,
  reclassifyPanoramas,
  reclassifySequences,
  updateManifests,
} from "./images";
import {
  isValidCurationManifest,
  isValidManifest,
  isValidPeopleManifest,
} from "./manifest-validators";

const logger = createLogger("ManifestLoader");

/**
 * In DEV mode on the server, reload manifests from disk to bypass Vite caching.
 * This ensures that API updates are immediately reflected in the UI.
 */
export async function reloadManifests() {
  if (dev && !building && typeof process !== "undefined") {
    try {
      // Use process.cwd() to find project root
      const contentDir = process.env.CONTENT_DIR || "egypt-2025"; // Fallback to egypt if not set
      const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

      const { readFileText } = await import("$scripts/utils/runtime");

      let nextManifest: Manifest | null = null;
      let nextPeople: PeopleManifest | null = null;
      let nextCuration: CurationManifest | null = null;

      // Reload Images Manifest
      try {
        const raw = await readFileText(path.join(dataDir, "images.manifest.json"));
        const json = JSON.parse(raw);
        if (isValidManifest(json)) {
          nextManifest = reclassifySequences(reclassifyPanoramas(reclassifyCollages(json)));
        }
      } catch (_e) {
        logger.error({ err: _e }, "Failed to reload images manifest");
      }

      // Reload People Manifest
      try {
        const raw = await readFileText(path.join(dataDir, "people.manifest.json"));
        const json = JSON.parse(raw);
        if (isValidPeopleManifest(json)) {
          nextPeople = normalizePeople(json);
        }
      } catch (_e) {}

      // Reload Curation Manifest
      try {
        const raw = await readFileText(path.join(dataDir, "curation.manifest.json"));
        const json = JSON.parse(raw);
        if (isValidCurationManifest(json)) {
          nextCuration = json;
        }
      } catch (_e) {
        // Curation manifest might not exist
      }

      // Atomic Update
      updateManifests(nextManifest, nextPeople, nextCuration);
    } catch (_e) {
      logger.error({ err: _e }, "Manifest reload outer error");
    }
  } else {
    logger.debug(
      `Skipped: dev=${dev}, building=${building}, hasProcess=${typeof process !== "undefined"}`,
    );
  }
}
