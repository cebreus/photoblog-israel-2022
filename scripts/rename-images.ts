import { confirm, intro, outro, select, spinner, text } from "@clack/prompts";
import { exiftool } from "exiftool-vendored";
import path from "node:path";
import { createLogger } from "$scripts/core/cli-logger";
import { parseCliArguments } from "$scripts/core/cli-parser";
import {
  backupManifests,
  migrateAnalysisManifest,
  migrateCache,
  migrateClusteringConstraintsManifest,
  migrateCollageFiles,
  migrateCurationManifest,
  migrateEmbeddingsManifest,
  migrateFacesManifest,
  migrateGeneratedAssets,
  migrateImagesManifest,
  migrateMarkdownFiles,
  migrateMenuManifest,
  migratePeopleManifest,
  restoreManifests,
} from "$scripts/gallery/migration";
import { analyzeRenameCandidates, type RenameMap, safeRename } from "$scripts/gallery/renaming";
import { loadImagesManifest } from "$scripts/manifests/repository";
import { readdir, stat, writeFile } from "$scripts/utils/runtime";
import { formatDuration } from "$scripts/utils/time";

const logger = createLogger("rename-images");

const options = parseCliArguments(process.argv.slice(2));
const values = options;

async function getGalleries() {
  const contentDir = path.resolve("content");

  const entries = await readdir(contentDir, { withFileTypes: true });
  return entries.filter((e: any) => e.isDirectory()).map((e: any) => e.name);
}

async function getGalleryOrPrompt(galleries: string[]): Promise<string> {
  if (values.gallery && galleries.includes(values.gallery)) {
    return values.gallery;
  }

  const selected = await select({
    message: "Select a gallery to rename images in:",
    options: galleries.map((g) => ({ value: g, label: g })),
  });

  if (typeof selected !== "string") {
    outro("Operation cancelled.");
    process.exit(0);
  }
  return selected;
}

/**
 * Core function to apply renames on disk.
 */
async function applyRenames(renameMap: RenameMap, sProgress: { message: (msg: string) => void }) {
  sProgress.message("Renaming files...");
  for (const item of renameMap.values()) {
    const result = await safeRename(item.oldPath, item.newPath);
    if (!result.success && !result.skipped) {
      throw new Error(`Failed to rename ${item.oldName}: ${result.error}`);
    }
  }
}

/**
 * Mode 1: Simple Rename
 * Just renames files in place. No backups, no manifest updates.
 */
async function runSimpleRename(renameMap: RenameMap): Promise<void> {
  const s = spinner();
  s.start("Renaming files...");

  try {
    await applyRenames(renameMap, s);
    s.stop(`Successfully renamed ${renameMap.size} files.`);
  } catch (err) {
    s.stop("Renaming failed!", 1);
    throw err;
  }
}

/**
 * Mode 2: Full Migration
 * Backs up manifests, renames files, updates all manifests/cache/assets, and restores on failure.
 */
async function runFullMigration(gallery: string, renameMap: RenameMap): Promise<void> {
  const sRun = spinner();
  sRun.start("Creating backup and starting migration...");

  let backupDir: string | null = null;

  try {
    // 1. Transactional Backup
    backupDir = await backupManifests(gallery);

    // 2. Rename Files
    await applyRenames(renameMap, sRun);

    sRun.message("Migrating assets and manifests...");

    // 3. Migrate Everything
    await migrateGeneratedAssets(gallery, renameMap);
    await migrateCache(gallery, renameMap);
    await migrateImagesManifest(gallery, renameMap);
    await migratePeopleManifest(gallery, renameMap);
    await migrateFacesManifest(gallery, renameMap);
    await migrateCurationManifest(gallery, renameMap);
    await migrateClusteringConstraintsManifest(gallery, renameMap);
    await migrateMenuManifest(gallery, renameMap);
    await migrateMarkdownFiles(gallery, renameMap);
    await migrateCollageFiles(gallery, renameMap);
    await migrateAnalysisManifest(gallery, renameMap);
    await migrateEmbeddingsManifest(gallery, renameMap);

    sRun.stop(`Successfully processed ${renameMap.size} files.`);
  } catch (err) {
    sRun.stop("Migration failed!", 1);
    logger.error({ err }, "Error during migration");

    if (backupDir) {
      const sRestore = spinner();
      sRestore.start("Restoring manifests from backup...");
      try {
        await restoreManifests(gallery, backupDir);
        sRestore.stop("Restoration complete.");
        logger.warn(
          "NOTE: Source files may still be renamed. Manual check required for file naming.",
        );
      } catch (restoreErr) {
        sRestore.stop("Restoration FAILED!", 1);
        logger.error({ err: restoreErr }, "CRITICAL: Failed to restore backup");
      }
    }
    process.exit(1);
  }
}

async function main() {
  intro("🖼️  Smart Image Renamer");

  const galleries = await getGalleries();
  if (galleries.length === 0) {
    outro("No galleries found in content/.");
    return;
  }

  const gallery = await getGalleryOrPrompt(galleries);

  let defaultAuthor = typeof values.author === "string" ? values.author : "";
  if (!values.author) {
    const defaultAuthorInput = await text({
      message: "Default author (leave empty to omit author from filename if missing in EXIF):",
      placeholder: "",
      defaultValue: "",
    });

    if (typeof defaultAuthorInput !== "string") {
      outro("Operation cancelled.");
      process.exit(0);
    }
    defaultAuthor = defaultAuthorInput;
  }

  const s = spinner();
  s.start("Analyzing images...");

  // Determine mode based on sourceFolder usage
  const isSimpleMode = !!values.sourceFolder;
  const picsDir = values.sourceFolder
    ? path.resolve(values.sourceFolder)
    : path.resolve(`content/${gallery}/pics`);

  try {
    const stats = await stat(picsDir);
    if (!stats.isDirectory()) {
      throw new Error("Not a directory");
    }
  } catch {
    s.stop("Directory error!");
    outro(`Directory not found or invalid: ${picsDir}`);
    process.exit(1);
  }

  // Load existing manifest to find authors not in EXIF
  // Only useful if we are in standard mode OR if filenames match manifest IDs
  const imagesManifest = await loadImagesManifest(`src/data/${gallery}`);

  const renameMap = await analyzeRenameCandidates(
    picsDir,
    defaultAuthor,
    imagesManifest ?? undefined,
  );

  await exiftool.end();
  s.stop(`Analysis complete.`);

  if (renameMap.size === 0) {
    outro("All files seem to be already named correctly or no changes needed.");
    return;
  }

  // Dry-run mode: export JSON and exit
  if (values.dryRun) {
    const jsonPath = path.join(process.cwd(), `rename-plan-${gallery}-${Date.now()}.json`);
    const plan = Array.from(renameMap.values());

    await writeFile(jsonPath, JSON.stringify(plan, null, 2));

    outro(`
      🔍 Dry-run complete!
      - ${renameMap.size} files would be renamed
      - Plan saved to: ${jsonPath}
      
      Review the JSON and run scripts/revert-rename.ts if needed (after executing).
    `);
    return;
  }

  const modeMessage = isSimpleMode
    ? `Ready to rename ${renameMap.size} files in '${values.sourceFolder}'. (Simple Mode: No migrations)`
    : `Ready to rename ${renameMap.size} files. This involves migrating cache, manifests, and content. Continue?`;

  const shouldContinue = await confirm({
    message: modeMessage,
  });

  if (!shouldContinue) {
    outro("Cancelled.");
    process.exit(0);
  }

  if (isSimpleMode) {
    await runSimpleRename(renameMap);
  } else {
    await runFullMigration(gallery, renameMap);
  }

  outro(`
    ✅ Done!
    ${
      isSimpleMode
        ? "- Files renamed."
        : `- Source files renamed.
    - Generated assets renamed.
    - Cache updated.
    - Manifests logging updated.
    - Manifests updated.
    - Markdown references updated.
    
    Now run:
    1. bun run build (to verify integrity)
    2. bun run dev (to preview)`
    }
    `);
}

if (import.meta.main) {
  (async () => {
    const startTime = performance.now();
    try {
      await main();
      outro(`Total time: ${formatDuration(performance.now() - startTime)}`);
    } catch (error) {
      logger.error({ err: error }, "Rename script failed");
    }
  })();
}
