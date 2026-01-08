import fsp from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../core/cli-logger";

const logger = createLogger("cleanup");

export async function removeEmptyDirectory(
  dirPath: string,
  log: typeof logger = logger,
): Promise<boolean> {
  try {
    const entries = await fsp.readdir(dirPath);
    if (entries.length === 0) {
      await fsp.rmdir(dirPath);
      log.verbose({ dirPath }, "Removed empty directory");
      return true;
    }
    return false;
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return false;
    }
    log.warn({ dirPath, err: e }, "Failed to check/remove directory");
    return false;
  }
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
  const formats = ["jpeg", "jpg", "webp", "avif", "png"];

  for (const folder of outputFolders) {
    const dir = path.join(outputRoot, folder);

    try {
      await fsp.access(dir);
    } catch {
      continue;
    }

    for (const format of formats) {
      const filePath = path.join(dir, `${imageBaseName}.${format}`);
      try {
        await fsp.unlink(filePath);
        deleted.push(filePath);
      } catch (e: any) {
        if (e.code !== "ENOENT") {
          errors.push(`Failed to delete ${filePath}: ${e.message}`);
        }
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
  try {
    const content = await fsp.readFile(cachePath, "utf-8");
    const cache = JSON.parse(content);

    if (cache.files?.[imageKey]) {
      delete cache.files[imageKey];
      await fsp.writeFile(cachePath, JSON.stringify(cache, null, 2));
      log.verbose({ imageKey }, "Removed from cache");
      return true;
    }
    return false;
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      log.warn({ err: e }, "Failed to update cache");
    }
    return false;
  }
}

export async function removeImageFromConstraints(
  constraintsPath: string,
  imageId: string,
  log: typeof logger = logger,
): Promise<{ disconnectsRemoved: number; connectsRemoved: number }> {
  let disconnectsRemoved = 0;
  let connectsRemoved = 0;

  try {
    const content = await fsp.readFile(constraintsPath, "utf-8");
    const constraints = JSON.parse(content);

    const originalDisconnects = constraints.disconnects?.length || 0;
    const originalConnects = constraints.connects?.length || 0;

    if (constraints.disconnects) {
      constraints.disconnects = constraints.disconnects.filter(
        (c: { imageId: string }) => c.imageId !== imageId,
      );
      disconnectsRemoved = originalDisconnects - constraints.disconnects.length;
    }

    if (constraints.connects) {
      constraints.connects = constraints.connects.filter(
        (c: { imageId: string }) => c.imageId !== imageId,
      );
      connectsRemoved = originalConnects - constraints.connects.length;
    }

    if (disconnectsRemoved > 0 || connectsRemoved > 0) {
      await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
      log.verbose(
        { disconnectsRemoved, connectsRemoved, imageId },
        "Removed constraints for image",
      );
    }

    return { disconnectsRemoved, connectsRemoved };
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      log.warn({ err: e }, "Failed to clean constraints");
    }
    return { disconnectsRemoved: 0, connectsRemoved: 0 };
  }
}

export async function findOrphanFaceCrops(
  facesDir: string,
  validPersonIds: Set<string>,
  validImageIds: Set<string>,
  log: typeof logger = logger,
): Promise<{ orphanFolders: string[]; orphanFiles: string[] }> {
  const orphanFolders: string[] = [];
  const orphanFiles: string[] = [];

  try {
    const personFolders = await fsp.readdir(facesDir);

    for (const personFolder of personFolders) {
      const personPath = path.join(facesDir, personFolder);
      const stat = await fsp.stat(personPath);

      if (!stat.isDirectory()) continue;

      // Check if person exists in manifest
      if (!validPersonIds.has(personFolder)) {
        orphanFolders.push(personFolder);
        continue;
      }

      // Check each face crop file
      const files = await fsp.readdir(personPath);
      for (const file of files) {
        if (!file.endsWith(".jpg")) continue;

        const imageId = path.basename(file, ".jpg");
        if (!validImageIds.has(imageId)) {
          orphanFiles.push(path.join(personFolder, file));
        }
      }
    }
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      log.warn({ err: e }, "Failed to scan faces directory");
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

    try {
      const files = await fsp.readdir(dir);

      for (const file of files) {
        const baseName = path.parse(file).name;
        if (!validImageBaseNames.has(baseName)) {
          orphans.push(path.join(folder, file));
        }
      }
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        log.warn({ dir, err: e }, "Failed to scan directory");
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
    const stats = await fsp.stat(filePath);
    return stats.size;
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
  try {
    await fsp.access(facesDir);
  } catch {
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
      try {
        const files = await fsp.readdir(folderPath);
        for (const file of files) {
          result.bytesFreed += await getFileSize(path.join(folderPath, file));
        }
        result.foldersRemoved++;
      } catch {
        // Ignore
      }
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
    try {
      // Count size before deleting
      const files = await fsp.readdir(folderPath);
      for (const file of files) {
        result.bytesFreed += await getFileSize(path.join(folderPath, file));
        result.faceCropsRemoved++;
      }

      await fsp.rm(folderPath, { recursive: true, force: true });
      result.foldersRemoved++;
      log.verbose({ folder }, "Removed orphan person folder");
    } catch (e: any) {
      log.warn({ folderPath, err: e }, "Failed to remove folder");
    }
  }

  // Delete orphan files (individual face crops)
  for (const file of orphanFiles) {
    const filePath = path.join(facesDir, file);
    try {
      result.bytesFreed += await getFileSize(filePath);
      await fsp.unlink(filePath);
      result.faceCropsRemoved++;
      log.verbose({ file }, "Removed orphan face crop");
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        log.warn({ filePath, err: e }, "Failed to remove orphan face crop");
      }
    }
  }

  // Clean up now-empty directories
  try {
    const remainingFolders = await fsp.readdir(facesDir);
    for (const folder of remainingFolders) {
      const folderPath = path.join(facesDir, folder);
      const stat = await fsp.stat(folderPath);
      if (stat.isDirectory()) {
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
