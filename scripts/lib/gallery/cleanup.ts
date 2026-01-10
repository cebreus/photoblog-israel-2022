/**
 * @fileoverview Gallery cleanup helpers for removing generated assets and empty folders.
 *
 * @description
 * Utilities to remove empty directories, generated assets and to clean caches for a gallery.
 */
import { createLogger } from "$scripts/core/cli-logger";
import {
  fileExists,
  isJpegPath,
  readdir,
  readFileText,
  safeRm,
  safeUnlink,
  stat,
  writeFile,
} from "$scripts/utils/runtime";
import { SUPPORTED_OUTPUT_FORMATS } from "$shared/types/images";
import path from "node:path";

const logger = createLogger("cleanup");

export async function removeEmptyDirectory(
  dirPath: string,
  log: typeof logger = logger,
): Promise<boolean> {
  const entries = await readdir(dirPath).catch((e: unknown) => {
    if ((e as { code?: string }).code !== "ENOENT") {
      log.warn({ dirPath, err: e }, "Failed to read directory for cleanup");
    }
    return null;
  });

  if (entries !== null && entries.length === 0) {
    await safeRm(dirPath, { recursive: true });
    log.verbose({ dirPath }, "Removed empty directory");
    return true;
  }
  return false;
}

export async function removeEmptyPersonFolder(
  facesDir: string,
  personId: string,
  log: typeof logger = logger,
): Promise<boolean> {
  const folderPath = path.join(facesDir, personId);
  return removeEmptyDirectory(folderPath, log);
}

export interface OutputFolderConfig {
  folderName: string;
  formats: string[];
}

export function getOutputFolders(config: {
  outputs: Record<string, { folderName?: string; kind?: string }>;
  formats: string[] | readonly string[];
}): string[] {
  const folders: string[] = [];

  for (const [_key, conf] of Object.entries(config.outputs)) {
    if (conf.folderName) {
      folders.push(conf.folderName);

      if (conf.kind === "variant") {
        for (const fmt of config.formats) {
          if (fmt !== "jpeg") {
            // jpeg is usually default folder
            folders.push(`${conf.folderName}-${fmt}`);
          }
        }
      }
    }
  }

  return folders;
}

export async function deleteGeneratedAssets(
  imageBaseName: string,
  outputRoot: string,
  outputFolders: string[],
): Promise<{ deleted: string[]; errors: string[] }> {
  const deleted: string[] = [];
  const errors: string[] = [];
  const formats = SUPPORTED_OUTPUT_FORMATS;

  for (const folder of outputFolders) {
    const dir = path.join(outputRoot, folder);

    // Skip non-existent directories
    if (!(await fileExists(dir))) continue;

    for (const format of formats) {
      const filePath = path.join(dir, `${imageBaseName}.${format}`);
      if (await fileExists(filePath)) {
        await safeUnlink(filePath);
        deleted.push(filePath);
      }
    }
  }

  return { deleted, errors };
}

export async function removeFromCache(
  cachePath: string,
  imageKey: string,
  log: typeof logger = logger,
): Promise<boolean> {
  if (!(await fileExists(cachePath))) return false;

  const content = await readFileText(cachePath);
  const cache = JSON.parse(content);

  if (cache.files?.[imageKey]) {
    delete cache.files[imageKey];
    await writeFile(cachePath, JSON.stringify(cache, null, 2));
    log.verbose({ imageKey }, "Removed from cache");
    return true;
  }
  return false;
}

export async function removeImageFromConstraints(
  constraintsPath: string,
  imageId: string,
  log: typeof logger = logger,
): Promise<{ disconnectsRemoved: number; connectsRemoved: number }> {
  if (!(await fileExists(constraintsPath))) {
    return { disconnectsRemoved: 0, connectsRemoved: 0 };
  }

  const content = await readFileText(constraintsPath);
  const constraints = JSON.parse(content);

  const originalDisconnects = constraints.disconnects?.length || 0;
  const originalConnects = constraints.connects?.length || 0;

  if (constraints.disconnects) {
    constraints.disconnects = constraints.disconnects.filter(
      (c: { imageId: string }) => c.imageId !== imageId,
    );
  }

  if (constraints.connects) {
    constraints.connects = constraints.connects.filter(
      (c: { imageId: string }) => c.imageId !== imageId,
    );
  }

  const disconnectsRemoved = originalDisconnects - (constraints.disconnects?.length || 0);
  const connectsRemoved = originalConnects - (constraints.connects?.length || 0);

  if (disconnectsRemoved > 0 || connectsRemoved > 0) {
    await writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
    log.verbose({ disconnectsRemoved, connectsRemoved, imageId }, "Removed constraints for image");
  }

  return { disconnectsRemoved, connectsRemoved };
}

export async function findOrphanFaceCrops(
  facesDir: string,
  validPersonIds: Set<string>,
  validImageIds: Set<string>,
  log: typeof logger = logger,
): Promise<{ orphanFolders: string[]; orphanFiles: string[] }> {
  const orphanFolders: string[] = [];
  const orphanFiles: string[] = [];

  const personFolders = await readdir(facesDir).catch((e: unknown) => {
    if ((e as { code?: string }).code !== "ENOENT") {
      log.warn({ err: e }, "Failed to scan faces directory");
    }
    return [] as string[];
  });

  for (const personFolder of personFolders) {
    const personPath = path.join(facesDir, personFolder);
    const s = await stat(personPath).catch(() => null);

    if (!s || !s.isDirectory()) continue;

    // Check if person exists in manifest
    if (!validPersonIds.has(personFolder)) {
      orphanFolders.push(personFolder);
      continue;
    }

    // Check each face crop file
    const files = await readdir(personPath).catch(() => [] as string[]);
    for (const file of files) {
      if (!isJpegPath(file)) continue;

      const imageId = path.basename(file, path.extname(file));
      if (!validImageIds.has(imageId)) {
        orphanFiles.push(path.join(personFolder, file));
      }
    }
  }

  return { orphanFolders, orphanFiles };
}

export async function findOrphanAssets(
  outputRoot: string,
  outputFolders: string[],
  validImageBaseNames: Set<string>,
  log: typeof logger = logger,
): Promise<string[]> {
  const orphans: string[] = [];

  for (const folder of outputFolders) {
    const dir = path.join(outputRoot, folder);

    const files = await readdir(dir).catch((e: unknown) => {
      if ((e as { code?: string }).code !== "ENOENT") {
        log.warn({ dir, err: e }, "Failed to scan directory");
      }
      return [] as string[];
    });

    for (const file of files) {
      const baseName = path.parse(file).name;
      if (!validImageBaseNames.has(baseName)) {
        orphans.push(path.join(folder, file));
      }
    }
  }

  return orphans;
}

export interface OrphanCleanupResult {
  faceCropsRemoved: number;
  foldersRemoved: number;
  assetsRemoved: number;
  bytesFreed: number;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

/**
 * Get file size safely
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return 0;
  }
}

/**
 * Clean all orphaned assets for a gallery.
 * This includes:
 * - Face crops for deleted/merged people
 * - Face crops for deleted images
 * - Empty person directories
 * - Output variants without corresponding source images
 *
 * @param gallery - Gallery name (e.g., "egypt-2025")
 * @param validPersonIds - Set of valid person IDs from people manifest
 * @param validImageIds - Set of valid image IDs from images manifest
 * @param dryRun - If true, only report what would be cleaned
 */
export async function cleanOrphanedAssets(
  gallery: string,
  validPersonIds: Set<string>,
  validImageIds: Set<string>,
  dryRun = false,
  log: typeof logger = logger,
): Promise<OrphanCleanupResult> {
  const projectRoot = process.cwd();
  const facesDir = path.resolve(projectRoot, `static-${gallery}/faces`);

  const result: OrphanCleanupResult = {
    faceCropsRemoved: 0,
    foldersRemoved: 0,
    assetsRemoved: 0,
    bytesFreed: 0,
  };

  // Check if faces directory exists
  if (!(await fileExists(facesDir))) {
    return result;
  }

  // Find orphans
  const { orphanFolders, orphanFiles } = await findOrphanFaceCrops(
    facesDir,
    validPersonIds,
    validImageIds,
    log,
  );

  if (orphanFolders.length === 0 && orphanFiles.length === 0) {
    return result;
  }

  log.info(
    { folderCount: orphanFolders.length, cropCount: orphanFiles.length },
    "Found orphan assets",
  );

  if (dryRun) {
    // Just count sizes without deleting
    for (const folder of orphanFolders) {
      const folderPath = path.join(facesDir, folder);
      const files = await readdir(folderPath).catch(() => [] as string[]);
      for (const file of files) {
        result.bytesFreed += await getFileSize(path.join(folderPath, file));
      }
      result.foldersRemoved++;
    }
    for (const file of orphanFiles) {
      result.bytesFreed += await getFileSize(path.join(facesDir, file));
      result.faceCropsRemoved++;
    }
    log.info({ freedBytes: formatBytes(result.bytesFreed) }, "[DRY RUN] Would free space");
    return result;
  }

  // Delete orphan folders (entire person directories)
  for (const folder of orphanFolders) {
    const folderPath = path.join(facesDir, folder);
    // Count size before deleting
    const files = await readdir(folderPath).catch(() => [] as string[]);
    for (const file of files) {
      result.bytesFreed += await getFileSize(path.join(folderPath, file));
      result.faceCropsRemoved++;
    }

    await safeRm(folderPath, { recursive: true });
    result.foldersRemoved++;
    log.verbose({ folder }, "Removed orphan person folder");
  }

  // Delete orphan files (individual face crops)
  for (const file of orphanFiles) {
    const filePath = path.join(facesDir, file);
    result.bytesFreed += await getFileSize(filePath);
    await safeUnlink(filePath);
    result.faceCropsRemoved++;
    log.verbose({ file }, "Removed orphan face crop");
  }

  // Clean up now-empty directories
  try {
    const remainingFolders = await readdir(facesDir);
    for (const folder of remainingFolders) {
      const folderPath = path.join(facesDir, folder);
      const s = await stat(folderPath);
      if (s.isDirectory()) {
        const isEmpty = await removeEmptyDirectory(folderPath, log);
        if (isEmpty) {
          result.foldersRemoved++;
        }
      }
    }
  } catch {
    // Ignore errors during final cleanup
  }

  if (result.faceCropsRemoved > 0 || result.foldersRemoved > 0) {
    log.info(
      {
        faceCropsRemoved: result.faceCropsRemoved,
        foldersRemoved: result.foldersRemoved,
        freed: formatBytes(result.bytesFreed),
      },
      "Cleaned orphaned assets",
    );
  }

  return result;
}
