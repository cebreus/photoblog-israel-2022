import path from "node:path";
import { intro, outro } from "@clack/prompts";
import { createLogger } from "./lib/core/cli-logger";
import { resolveGalleryDirectory } from "./lib/gallery/resolver";
import { loadImagesManifest, saveImagesManifest } from "./lib/manifests/repository";

const logger = createLogger("cleanup-embeddings");

async function main() {
  intro("🧹 Cleanup Embeddings");

  const contentDir = await resolveGalleryDirectory();
  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);

  logger.info(`Cleaning manifest in: ${dataDir}`);

  const manifest = await loadImagesManifest(dataDir);
  if (!manifest) {
    logger.error("Manifest not found");
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
    logger.info(`Removed 'embedding' from ${cleanedCount} images.`);
  } else {
    logger.info("No embeddings found to clean.");
  }

  outro("Done");
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
