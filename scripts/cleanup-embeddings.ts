import { createLogger } from "$scripts/core/cli-logger";
import { resolveGalleryDirectory } from "$scripts/gallery/resolver";
import { loadImagesManifest, saveImagesManifest } from "$scripts/manifests/repository";
import { intro, outro } from "@clack/prompts";
import path from "node:path";

const logger = createLogger("cleanup-embeddings");

async function main() {
  intro("🧹 Cleanup Embeddings");

  const contentDir = await resolveGalleryDirectory();
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);

  logger.info({ dataDir }, "Cleaning manifest in directory");

  const manifest = await loadImagesManifest(dataDir);
  if (!manifest) {
    logger.error({ dataDir }, "Manifest not found");
    process.exit(1);
  }

  let cleanedCount = 0;

  for (const day of manifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image" && item.analysis) {
        if ("embedding" in item.analysis) {
          // Force delete by casting to any or using delete operator
          delete (item.analysis as any).embedding;
          cleanedCount++;
        }
      }
    }
  }

  if (cleanedCount > 0) {
    await saveImagesManifest(dataDir, manifest);
    logger.info({ cleanedCount }, "Removed 'embedding' from images successfully");
  } else {
    logger.info({ dataDir }, "No embeddings found to clean");
  }

  outro("Done");
}

function handleError(err: any) {
  logger.error({ err }, "Fatal error during embeddings cleanup");
  process.exit(1);
}

main().catch(handleError);
