import path from "node:path";
import { createLogger } from "$scripts/core/cli-logger";
import {
  loadFaceEmbeddingsManifest,
  loadPeopleManifest,
  saveFaceEmbeddingsManifest,
  savePeopleManifest,
} from "$scripts/manifests/repository";

const logger = createLogger("migrate-embeddings");

/**
 * Migrates face embeddings from people.manifest.json to separate face-embeddings.manifest.json.
 * This reduces people manifest size from ~1.5MB to ~50KB and enables lazy loading in UI.
 */
async function migrateEmbeddings() {
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

  logger.info({ contentDir }, "Starting embeddings migration");

  // Load existing manifests
  const peopleManifest = await loadPeopleManifest(dataDir, logger);
  if (!peopleManifest) {
    logger.error({}, "Failed to load people manifest");
    process.exit(1);
  }

  const existingEmbeddings = (await loadFaceEmbeddingsManifest(dataDir, logger)) || {};

  // Extract embeddings to separate manifest
  const faceEmbeddings: Record<string, any> = { ...existingEmbeddings };
  let migratedCount = 0;
  let alreadyCleanCount = 0;

  for (const person of peopleManifest.people) {
    const hasDescriptor = person.faceDescriptor && person.faceDescriptor.length > 0;
    const hasClusters = person.clusters && person.clusters.length > 0;

    if (hasDescriptor || hasClusters) {
      faceEmbeddings[person.id] = {
        faceDescriptor: hasDescriptor ? person.faceDescriptor : undefined,
        clusters: hasClusters ? person.clusters : undefined,
      };

      // Remove from person object (deprecated fields)
      delete person.faceDescriptor;
      delete person.clusters;

      migratedCount++;
    } else {
      alreadyCleanCount++;
    }
  }

  // Save updated manifests
  await saveFaceEmbeddingsManifest(dataDir, faceEmbeddings, logger);
  await savePeopleManifest(dataDir, peopleManifest, logger);

  logger.info(
    {
      migratedCount,
      alreadyCleanCount,
      totalPeople: peopleManifest.people.length,
    },
    "Embeddings migration complete",
  );
}

migrateEmbeddings().catch((err: any) => {
  logger.error({ err }, "Migration failed");
  process.exit(1);
});
