import path from "node:path";
import type {
  AnalysisManifest,
  EmbeddingsManifest,
  FacesManifest,
  Manifest,
} from "../src/lib/types/manifest";
import { createLogger } from "./lib/core/cli-logger";
import {
  loadManifest,
  saveAnalysisManifest,
  saveEmbeddingsManifest,
  saveFacesManifest,
} from "./lib/manifests/repository";

const logger = createLogger("migrate-manifests");

async function migrate(outRoot: string) {
  const manifestPath = path.join(outRoot, "images.manifest.json");
  logger.info(`Migrating manifest at ${manifestPath}...`);

  const manifest = await loadManifest<Manifest>(manifestPath);
  if (!manifest) {
    logger.error(`Could not load manifest at ${manifestPath}`);
    return;
  }

  const analysisManifest: AnalysisManifest = {};
  const embeddingsManifest: EmbeddingsManifest = {};
  const facesManifest: FacesManifest = {};

  let count = 0;
  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type !== "image") continue;

      const imageId = item.src; // Filename is the key
      count++;

      // Analysis data
      if (item.analysis) {
        analysisManifest[imageId] = {
          aestheticScore: item.analysis.aestheticScore,
          sharpness: item.analysis.sharpness,
          qualityBucket: item.analysis.qualityBucket,
          phash: item.analysis.phash,
        };

        if (item.analysis.embedding && item.analysis.embedding.length > 0) {
          embeddingsManifest[imageId] = item.analysis.embedding;
        }

        if (
          item.analysis.facesDetected !== undefined ||
          (item.analysis.faces && item.analysis.faces.length > 0)
        ) {
          facesManifest[imageId] = {
            facesDetected:
              item.analysis.facesDetected ??
              (item.analysis.faces && item.analysis.faces.length > 0) ??
              false,
            faces: item.analysis.faces ?? [],
            peopleIds: item.people ?? [],
          };
        }
      }
    }
  }

  logger.info(`Processed ${count} images. Saving new manifests...`);

  await saveAnalysisManifest(outRoot, analysisManifest);
  await saveEmbeddingsManifest(outRoot, embeddingsManifest);
  await saveFacesManifest(outRoot, facesManifest);

  logger.info("Migration complete.");
}

const args = process.argv.slice(2);
const outRoot =
  args[0] || (process.env.CONTENT_DIR ? path.join("static", process.env.CONTENT_DIR) : null);

if (!outRoot) {
  logger.error("Usage: bun migrate-manifests.ts <outRoot>");
  process.exit(1);
}

migrate(outRoot).catch((err) => {
  logger.error(err);
  process.exit(1);
});
