import { confirm, intro, outro, select, spinner, text } from "@clack/prompts";
import { exiftool } from "exiftool-vendored";
import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import {
  migrateCache,
  migrateCurationManifest,
  migrateGeneratedAssets,
  migrateImagesManifest,
  migrateMarkdownFiles,
  migratePeopleManifest,
} from "./lib/gallery-migration";
import { type RenameMap, getNewBasename, safeRename } from "./lib/renaming-utils";

async function getGalleries() {
  const contentDir = path.resolve("content");
  const entries = await fs.promises.readdir(contentDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function getGalleryOrPrompt(galleries: string[]): Promise<string> {
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

async function analyzeRenameCandidates(picsDir: string, defaultAuthor: string): Promise<RenameMap> {
  const files = await fg("*.{jpg,jpeg,png,webp,avif,heic}", {
    cwd: picsDir,
    absolute: true,
    deep: 1,
    caseSensitiveMatch: false,
  });

  const renameMap: RenameMap = new Map();
  const usedNames = new Set<string>();

  for (const file of files) {
    const ext = path.extname(file);
    const oldName = path.basename(file);
    const tags = await exiftool.read(file);

    const oldBase = path.basename(oldName, ext);
    const baseNewName = getNewBasename(tags, defaultAuthor, oldBase);

    let candidateName = `${baseNewName}${ext.toLowerCase()}`;

    let counter = 1;
    while (
      usedNames.has(candidateName) ||
      (candidateName !== oldName && fs.existsSync(path.join(picsDir, candidateName)))
    ) {
      candidateName = `${baseNewName}-${counter}${ext.toLowerCase()}`;
      counter++;
    }

    usedNames.add(candidateName);

    if (candidateName === oldName) continue;

    renameMap.set(file, {
      oldName,
      newName: candidateName,
      oldPath: file,
      newPath: path.join(path.dirname(file), candidateName),
      oldBase: path.basename(oldName, path.extname(oldName)),
      newBase: path.basename(candidateName, path.extname(candidateName)),
      oldRelPath: path.relative(picsDir, file),
      newRelPath: path.join(path.dirname(path.relative(picsDir, file)), candidateName),
    });
  }

  return renameMap;
}

async function executeRenameAndMigration(gallery: string, renameMap: RenameMap): Promise<void> {
  const sRun = spinner();
  sRun.start("Renaming and Migrating...");

  for (const item of renameMap.values()) {
    await safeRename(item.oldPath, item.newPath);
  }

  await migrateGeneratedAssets(gallery, renameMap);

  await migrateCache(gallery, renameMap);

  await migrateImagesManifest(gallery, renameMap);

  await migratePeopleManifest(gallery, renameMap);

  await migrateCurationManifest(gallery, renameMap);

  await migrateMarkdownFiles(gallery, renameMap);

  sRun.stop(`Successfully processed ${renameMap.size} files.`);
}

async function main() {
  intro("🖼️  Smart Image Renamer");

  const galleries = await getGalleries();
  if (galleries.length === 0) {
    outro("No galleries found in content/.");
    return;
  }

  const gallery = await getGalleryOrPrompt(galleries);

  const defaultAuthorInput = await text({
    message: "Default author (leave empty to omit author from filename if missing in EXIF):",
    placeholder: "",
    defaultValue: "",
  });

  if (typeof defaultAuthorInput !== "string") {
    outro("Operation cancelled.");
    process.exit(0);
  }
  const defaultAuthor = defaultAuthorInput;

  const s = spinner();
  s.start("Analyzing images...");

  const picsDir = path.resolve(`content/${gallery}/pics`);
  if (!fs.existsSync(picsDir)) {
    s.stop("No pics folder found!");
    outro(`Directory not found: ${picsDir}`);
    process.exit(1);
  }

  const renameMap = await analyzeRenameCandidates(picsDir, defaultAuthor);

  await exiftool.end();
  s.stop(`Analysis complete.`);

  if (renameMap.size === 0) {
    outro("All files seem to be already named correctly or no changes needed.");
    return;
  }

  const shouldContinue = await confirm({
    message: `Ready to rename ${renameMap.size} files. This involves migrating cache, manifests, and content. Continue?`,
  });

  if (!shouldContinue) {
    outro("Cancelled.");
    process.exit(0);
  }

  await executeRenameAndMigration(gallery, renameMap);

  outro(`
    ✅ Done!
    - Source files renamed.
    - Generated assets renamed.
    - Cache updated.
    - Manifests updated.
    - Markdown references updated.
    
    Now run:
    1. bun run build (to verify integrity)
    2. bun run dev (to preview)
    `);
}

if (import.meta.main) {
  (async () => {
    try {
      await main();
    } catch (error) {
      console.error(error);
    }
  })();
}
