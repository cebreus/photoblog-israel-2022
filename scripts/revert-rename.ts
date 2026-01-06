import path from "node:path";
import { confirm, intro, outro, select, spinner, text } from "@clack/prompts";
import { createLogger } from "./lib/core/cli-logger";
import { parseCliArguments } from "./lib/core/cli-parser";
import {
  backupManifests,
  migrateAnalysisManifest,
  migrateCache,
  migrateCurationManifest,
  migrateEmbeddingsManifest,
  migrateFacesManifest,
  migrateGeneratedAssets,
  migrateImagesManifest,
  migrateMarkdownFiles,
  migratePeopleManifest,
  restoreManifests,
} from "./lib/gallery/migration";
import { type RenameItem, type RenameMap, safeRename } from "./lib/gallery/renaming";
import { readFileText } from "./lib/utils/runtime";
import { formatDuration } from "./lib/utils/time";

const logger = createLogger("revert-rename");

const options = parseCliArguments(process.argv.slice(2));

async function getGalleries() {
  const contentDir = path.resolve("content");
  const entries = await import("node:fs/promises").then((fs) =>
    fs.readdir(contentDir, { withFileTypes: true }),
  );
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function getGalleryOrPrompt(galleries: string[]): Promise<string> {
  if (options.gallery && galleries.includes(options.gallery)) {
    return options.gallery;
  }

  const selected = await select({
    message: "Select a gallery:",
    options: galleries.map((g) => ({ value: g, label: g })),
  });

  if (typeof selected !== "string") {
    outro("Operation cancelled.");
    process.exit(0);
  }
  return selected;
}

async function loadRenameMapFromJson(jsonPath: string): Promise<RenameMap> {
  const content = await readFileText(jsonPath);
  const data = JSON.parse(content) as RenameItem[];

  const renameMap: RenameMap = new Map();

  for (const item of data) {
    // For revert, we swap old and new
    // The "item" describes how it WAS renamed (Old -> New)
    // To revert, we need to go (New -> Old)

    renameMap.set(item.newName, {
      oldName: item.newName, // Current name on disk (New)
      newName: item.oldName, // Target name (Old)
      oldPath: "", // Will be set based on gallery
      newPath: "",
      oldBase: item.newBase,
      newBase: item.oldBase,
      oldRelPath: item.newRelPath,
      newRelPath: item.oldRelPath,
    });
  }

  return renameMap;
}

async function executeRevert(gallery: string, renameMap: RenameMap): Promise<void> {
  const picsDir = path.resolve(`content/${gallery}/pics`);

  // Update paths
  for (const [_key, item] of renameMap.entries()) {
    item.oldPath = path.join(picsDir, item.oldName);
    item.newPath = path.join(picsDir, item.newName);
  }

  const sRun = spinner();
  sRun.start("Creating backup and reverting...");

  let backupDir: string | null = null;

  try {
    backupDir = await backupManifests(gallery);
    sRun.message("Reverting files...");

    // Rename files back
    for (const item of renameMap.values()) {
      const result = await safeRename(item.oldPath, item.newPath);
      if (!result.success && !result.skipped) {
        throw new Error(`Failed to revert ${item.oldName}: ${result.error}`);
      }
    }

    sRun.message("Reverting assets and manifests...");

    // Validate all references
    await migrateGeneratedAssets(gallery, renameMap);
    await migrateCache(gallery, renameMap);
    await migrateImagesManifest(gallery, renameMap);
    await migratePeopleManifest(gallery, renameMap);
    await migrateFacesManifest(gallery, renameMap);
    await migrateCurationManifest(gallery, renameMap);
    await migrateMarkdownFiles(gallery, renameMap);
    await migrateAnalysisManifest(gallery, renameMap);
    await migrateEmbeddingsManifest(gallery, renameMap);

    sRun.stop(`Successfully reverted ${renameMap.size} files.`);
  } catch (err) {
    sRun.stop("Revert failed!", 1);
    logger.error({ err }, "Error during revert");

    if (backupDir) {
      const sRestore = spinner();
      sRestore.start("Restoring manifests from backup...");
      try {
        await restoreManifests(gallery, backupDir);
        sRestore.stop("Restoration complete.");
        logger.warn({}, "NOTE: Files might be in mixed state. Check filenames manually");
      } catch (restoreErr) {
        sRestore.stop("Restoration FAILED!", 1);
        logger.error({ err: restoreErr }, "CRITICAL: Failed to restore backup");
      }
    }
    process.exit(1);
  }
}

async function main() {
  intro("🔄 Revert Image Rename");

  const galleries = await getGalleries();
  if (galleries.length === 0) {
    outro("No galleries found in content/.");
    return;
  }

  const gallery = await getGalleryOrPrompt(galleries);

  const jsonPathInput = await text({
    message: "Path to rename plan JSON file:",
    placeholder: "./rename-plan-egypt-2025-1234567890.json",
  });

  if (typeof jsonPathInput !== "string" || !jsonPathInput) {
    outro("Operation cancelled.");
    process.exit(0);
  }

  const jsonPath = path.resolve(jsonPathInput);

  try {
    await readFileText(jsonPath);
  } catch {
    outro(`JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  const renameMap = await loadRenameMapFromJson(jsonPath);

  if (renameMap.size === 0) {
    outro("No rename operations found in JSON.");
    return;
  }

  const shouldContinue = await confirm({
    message: `Ready to revert ${renameMap.size} files. This will undo the previous rename. Continue?`,
  });

  if (!shouldContinue) {
    outro("Cancelled.");
    process.exit(0);
  }

  await executeRevert(gallery, renameMap);

  outro(`
    ✅ Done!
    - ${renameMap.size} files reverted
    - All manifests and references updated
    
    Now run:
    1. bun run build (to verify integrity)
    2. bun run dev (to preview)
  `);
}

if (import.meta.main) {
  (async () => {
    const startTime = performance.now();
    try {
      await main();
      outro(`Total time: ${formatDuration(performance.now() - startTime)}`);
    } catch (error: any) {
      logger.error({ err: error, message: error.message }, "Revert script failed");
    }
  })();
}
