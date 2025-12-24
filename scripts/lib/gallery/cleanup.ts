import fsp from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../core/cli-logger";

const logger = createLogger("cleanup");

export async function removeEmptyDirectory(dirPath: string): Promise<boolean> {
  try {
    const entries = await fsp.readdir(dirPath);
    if (entries.length === 0) {
      await fsp.rmdir(dirPath);
      logger.verbose(`Removed empty directory: ${dirPath}`);
      return true;
    }
    return false;
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return false;
    }
    logger.warn(`Failed to check/remove directory ${dirPath}: ${e.message}`);
    return false;
  }
}

export async function removeEmptyPersonFolder(
  facesDir: string,
  personId: string,
): Promise<boolean> {
  const folderPath = path.join(facesDir, personId);
  return removeEmptyDirectory(folderPath);
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

export async function removeFromCache(cachePath: string, imageKey: string): Promise<boolean> {
  try {
    const content = await fsp.readFile(cachePath, "utf-8");
    const cache = JSON.parse(content);

    if (cache.files?.[imageKey]) {
      delete cache.files[imageKey];
      await fsp.writeFile(cachePath, JSON.stringify(cache, null, 2));
      logger.verbose(`Removed ${imageKey} from cache`);
      return true;
    }
    return false;
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      logger.warn(`Failed to update cache: ${e.message}`);
    }
    return false;
  }
}

export async function removeImageFromConstraints(
  constraintsPath: string,
  imageId: string,
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
      logger.verbose(
        `Removed ${disconnectsRemoved} disconnects, ${connectsRemoved} connects for ${imageId}`,
      );
    }

    return { disconnectsRemoved, connectsRemoved };
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      logger.warn(`Failed to clean constraints: ${e.message}`);
    }
    return { disconnectsRemoved: 0, connectsRemoved: 0 };
  }
}

export async function findOrphanFaceCrops(
  facesDir: string,
  validPersonIds: Set<string>,
  validImageIds: Set<string>,
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
      logger.warn(`Failed to scan faces directory: ${e.message}`);
    }
  }

  return { orphanFolders, orphanFiles };
}

export async function findOrphanAssets(
  outputRoot: string,
  outputFolders: string[],
  validImageBaseNames: Set<string>,
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
        logger.warn(`Failed to scan ${dir}: ${e.message}`);
      }
    }
  }

  return orphans;
}
