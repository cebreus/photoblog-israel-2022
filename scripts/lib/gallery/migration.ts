import fsp from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { toSlug } from "../../../shared/utils/strings";
import type { Cache } from "../../../src/lib/types/manifest";
import { config } from "../../build.config";
import { createLogger } from "../core/cli-logger";
import {
  loadAnalysisManifest,
  loadClusteringConstraints,
  loadCurationManifest,
  loadEmbeddingsManifest,
  loadFacesManifest,
  loadImagesManifest,
  loadMenuManifest,
  loadPeopleManifest,
  saveAnalysisManifest,
  saveClusteringConstraints,
  saveCurationManifest,
  saveEmbeddingsManifest,
  saveFacesManifest,
  saveImagesManifest,
  saveMenuManifest,
  savePeopleManifest,
} from "../manifests/repository";
import { getOutputFolders } from "./cleanup";
import { type RenameMap, safeRename } from "./renaming";

const logger = createLogger("migration");

/**
 * Checks if a directory exists.
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await fsp.access(dirPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Backs up all manifest files before migration.
 * Returns the path to the backup directory.
 */
export async function backupManifests(gallery: string): Promise<string> {
  const dataDir = path.resolve(`src/data/${gallery}`);
  const backupDir = path.resolve(`.temp/backup/${gallery}-${Date.now()}`);

  await fsp.mkdir(backupDir, { recursive: true });

  const manifests = await fg("*.manifest.json", { cwd: dataDir, absolute: true });

  for (const manifestPath of manifests) {
    const dest = path.join(backupDir, path.basename(manifestPath));
    await fsp.copyFile(manifestPath, dest);
  }

  logger.info(`Backed up ${manifests.length} manifests to ${backupDir}`);
  return backupDir;
}

/**
 * Restores manifests from backup in case of failure.
 */
export async function restoreManifests(gallery: string, backupDir: string): Promise<void> {
  const dataDir = path.resolve(`src/data/${gallery}`);

  if (!(await directoryExists(backupDir))) {
    logger.error(`Backup directory not found: ${backupDir}`);
    return;
  }

  const backups = await fg("*.manifest.json", { cwd: backupDir, absolute: true });

  for (const backupPath of backups) {
    const dest = path.join(dataDir, path.basename(backupPath));
    await fsp.copyFile(backupPath, dest);
  }

  logger.info(`Restored ${backups.length} manifests from ${backupDir}`);
}

/**
 * Migrates generated assets (images, thumbnails) on disk.
 */
export async function migrateGeneratedAssets(gallery: string, renameMap: RenameMap): Promise<void> {
  const staticParams = {
    outRoot: `static/${gallery}/images`,
  };

  const outputFolders = getOutputFolders({
    outputs: config.outputs,
    formats: config.encoding.formats,
  });

  const outputFormats = [...config.encoding.formats, "jpg", "png"];

  for (const item of renameMap.values()) {
    for (const folder of outputFolders) {
      const dir = path.join(staticParams.outRoot, folder);

      // Bun check for dir existence
      if (!(await Bun.file(dir).exists()) && !(await Bun.file(path.join(dir, ".keep")).exists())) {
        if (!(await directoryExists(dir))) continue;
      }

      for (const format of outputFormats) {
        const oldVariant = path.join(dir, `${item.oldBase}.${format}`);
        const newVariant = path.join(dir, `${item.newBase}.${format}`);

        if (await Bun.file(oldVariant).exists()) {
          await safeRename(oldVariant, newVariant);
        }
      }
    }

    // Rename face crops
    const facesRootDir = path.resolve(`static/${gallery}/faces`);
    if (await directoryExists(facesRootDir)) {
      const personDirs = await fsp.readdir(facesRootDir);
      for (const personDir of personDirs) {
        const oldCrop = path.join(facesRootDir, personDir, `${item.oldBase}.jpg`);
        const newCrop = path.join(facesRootDir, personDir, `${item.newBase}.jpg`);
        if (await Bun.file(oldCrop).exists()) {
          await safeRename(oldCrop, newCrop);
        }
      }
    }
  }
}

/**
 * Migrates the build cache.
 */
export async function migrateCache(gallery: string, renameMap: RenameMap): Promise<void> {
  const cachePath = path.resolve(`.temp/${gallery}/images.cache.json`);
  // Using generic loadManifest here would require exporting it, forcing internal usage
  const fs = await import("node:fs/promises");
  let cache: Cache | null = null;
  try {
    const content = await fs.readFile(cachePath, "utf-8");
    cache = JSON.parse(content);
  } catch {
    return;
  }

  if (cache?.files) {
    for (const item of renameMap.values()) {
      const oldKey = item.oldRelPath;
      const newKey = item.newRelPath;

      if (cache.files[oldKey]) {
        const entry = cache.files[oldKey];
        entry.outputs = entry.outputs.map((outPath) => {
          const dir = path.dirname(outPath);
          const ext = path.extname(outPath);
          const oldBase = path.basename(outPath, ext);
          if (oldBase === item.oldBase) {
            return path.join(dir, `${item.newBase}${ext}`);
          }
          return outPath;
        });

        cache.files[newKey] = entry;
        delete cache.files[oldKey];
      }
    }
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  }
}

/**
 * Generic helper to migrate simple Key-Value manifests where Key is the ImageID/Slug.
 * Used for: Analysis, Embeddings, Faces (slugified keys).
 */
async function migrateKeyValueManifest(
  gallery: string,
  renameMap: RenameMap,
  loader: (path: string) => Promise<any>,
  saver: (path: string, data: any) => Promise<void>,
  keyIsSlug = true,
): Promise<void> {
  const dataPath = `src/data/${gallery}`;
  const manifest = await loader(dataPath);
  if (!manifest) return;

  const lookup = new Map<string, string>();
  for (const v of renameMap.values()) {
    const key = keyIsSlug ? toSlug(v.oldBase) : v.oldBase;
    const val = keyIsSlug ? toSlug(v.newBase) : v.newBase;
    lookup.set(key, val);
  }

  const newManifest: any = {};
  let changed = false;

  for (const [oldId, data] of Object.entries(manifest)) {
    const newId = lookup.get(oldId);
    if (newId) {
      newManifest[newId] = data;
      changed = true;
    } else {
      newManifest[oldId] = data;
    }
  }

  if (changed) {
    await saver(dataPath, newManifest);
  }
}

/**
 * Migrates analysis.manifest.json
 */
export async function migrateAnalysisManifest(
  gallery: string,
  renameMap: RenameMap,
): Promise<void> {
  await migrateKeyValueManifest(gallery, renameMap, loadAnalysisManifest, saveAnalysisManifest);
}

/**
 * Migrates embeddings.manifest.json
 */
export async function migrateEmbeddingsManifest(
  gallery: string,
  renameMap: RenameMap,
): Promise<void> {
  await migrateKeyValueManifest(gallery, renameMap, loadEmbeddingsManifest, saveEmbeddingsManifest);
}

/**
 * Migrates faces.manifest.json
 */
export async function migrateFacesManifest(gallery: string, renameMap: RenameMap): Promise<void> {
  // Face manifest usage is slightly different but fits the pattern if we check keys
  // Faces manifest keys ARE image IDs (slugs)
  await migrateKeyValueManifest(gallery, renameMap, loadFacesManifest, saveFacesManifest);
}

/**
 * Migrates images.manifest.json (Complex Structure)
 */
export async function migrateImagesManifest(gallery: string, renameMap: RenameMap): Promise<void> {
  const manifest = await loadImagesManifest(`src/data/${gallery}`);

  if (manifest) {
    const lookup = new Map<string, typeof renameMap extends Map<any, infer V> ? V : never>();
    for (const v of renameMap.values()) {
      lookup.set(v.oldName, v);
    }

    for (const day of manifest.photoDays) {
      for (const item of day.items) {
        if (item.type === "image") {
          const match = lookup.get(item.src);
          if (match) {
            item.src = match.newName;
            item.id = toSlug(match.newBase);
            item.sources = item.sources.map((s) => {
              const ext = path.extname(s.path);
              const dir = path.dirname(s.path);
              return {
                ...s,
                path: path.join(dir, `${match.newBase}${ext}`),
              };
            });
          }
        }
      }
    }
    await saveImagesManifest(`src/data/${gallery}`, manifest);
  }
}

/**
 * Migrates people.manifest.json (Complex Structure)
 */
export async function migratePeopleManifest(gallery: string, renameMap: RenameMap): Promise<void> {
  const peopleManifest = await loadPeopleManifest(`src/data/${gallery}`);
  if (peopleManifest) {
    const lookup = new Map<string, typeof renameMap extends Map<any, infer V> ? V : never>();
    for (const v of renameMap.values()) {
      lookup.set(toSlug(v.oldBase), v);
    }

    let peopleChanged = false;
    for (const person of peopleManifest.people) {
      if (person.manualImageIds) {
        const newIds: string[] = [];
        let pChanged = false;
        for (const oldId of person.manualImageIds) {
          const match = lookup.get(oldId);
          if (match) {
            newIds.push(toSlug(match.newBase));
            pChanged = true;
          } else {
            newIds.push(oldId);
          }
        }
        if (pChanged) {
          person.manualImageIds = newIds;
          peopleChanged = true;
        }
      }

      if (person.thumbnail) {
        for (const item of renameMap.values()) {
          // thumbnail paths might rely on base name
          if (person.thumbnail.includes(`/${item.oldBase}.jpg`)) {
            person.thumbnail = person.thumbnail.replace(
              `/${item.oldBase}.jpg`,
              `/${item.newBase}.jpg`,
            );
            peopleChanged = true;
            break;
          }
        }
      }
    }
    if (peopleChanged) {
      await savePeopleManifest(`src/data/${gallery}`, peopleManifest);
    }
  }
}

/**
 * Migrates curation.manifest.json (Complex Structure)
 */
export async function migrateCurationManifest(
  gallery: string,
  renameMap: RenameMap,
): Promise<void> {
  const curationManifest = await loadCurationManifest(`src/data/${gallery}`);
  if (curationManifest) {
    const lookup = new Map<string, typeof renameMap extends Map<any, infer V> ? V : never>();
    for (const v of renameMap.values()) {
      lookup.set(toSlug(v.oldBase), v);
    }

    let curChanged = false;
    for (const group of curationManifest.groups) {
      const newItems: string[] = [];
      let groupChanged = false;
      for (const item of group.items) {
        const match = lookup.get(item);
        if (match) {
          newItems.push(toSlug(match.newBase));
          groupChanged = true;
        } else {
          newItems.push(item);
        }
      }
      if (groupChanged) {
        group.items = newItems;
        curChanged = true;
      }

      const matchBest = lookup.get(group.bestCandidateId);
      if (matchBest) {
        group.bestCandidateId = toSlug(matchBest.newBase);
        curChanged = true;
      }

      if (group.recommendations) {
        const newRecs: any = {};
        let recsChanged = false;
        for (const [key, val] of Object.entries(group.recommendations)) {
          const matchRec = lookup.get(key);
          if (matchRec) {
            newRecs[toSlug(matchRec.newBase)] = val;
            recsChanged = true;
          } else {
            newRecs[key] = val;
          }
        }
        if (recsChanged) {
          group.recommendations = newRecs;
          curChanged = true;
        }
      }
    }

    if (curChanged) {
      await saveCurationManifest(`src/data/${gallery}`, curationManifest);
    }
  }
}

/**
 * Migrates menu.manifest.json
 */
export async function migrateMenuManifest(gallery: string, renameMap: RenameMap): Promise<void> {
  const menuManifest = await loadMenuManifest(`src/data/${gallery}`);
  if (menuManifest) {
    const lookup = new Map<string, typeof renameMap extends Map<any, infer V> ? V : never>();
    for (const v of renameMap.values()) {
      lookup.set(toSlug(v.oldBase), v);
    }

    let menuChanged = false;
    for (const day of menuManifest) {
      if (day.locations) {
        for (const loc of day.locations) {
          if (loc.href?.startsWith("#")) {
            // Check if href points to an image ID (e.g. #slug)
            const id = loc.href.substring(1);
            const match = lookup.get(id);
            if (match) {
              loc.href = `#${toSlug(match.newBase)}`;
              menuChanged = true;
            }
          }
        }
      }
    }

    if (menuChanged) {
      await saveMenuManifest(`src/data/${gallery}`, menuManifest);
    }
  }
}

/**
 * Migrates clustering-constraints.json
 */
export async function migrateClusteringConstraintsManifest(
  gallery: string,
  renameMap: RenameMap,
): Promise<void> {
  const constraints = await loadClusteringConstraints(`src/data/${gallery}`);
  if (constraints) {
    const lookup = new Map<string, typeof renameMap extends Map<any, infer V> ? V : never>();
    for (const v of renameMap.values()) {
      lookup.set(toSlug(v.oldBase), v);
    }

    let changed = false;

    // Helper to update imageId in a list of items
    const updateList = (list: any[] | undefined) => {
      if (!list) return;
      for (const item of list) {
        if (item.imageId) {
          const match = lookup.get(item.imageId);
          if (match) {
            item.imageId = toSlug(match.newBase);
            changed = true;
          }
        }
      }
    };

    updateList(constraints.disconnects);
    updateList(constraints.connects);
    updateList(constraints.ignoredCrops);

    if (changed) {
      await saveClusteringConstraints(`src/data/${gallery}`, constraints);
    }
  }
}

/**
 * Migrates Markdown content
 */
export async function migrateMarkdownFiles(gallery: string, renameMap: RenameMap): Promise<void> {
  const mdFiles = await fg("**/*.md", { cwd: path.resolve(`content/${gallery}`), absolute: true });
  for (const mdFile of mdFiles) {
    const file = Bun.file(mdFile);
    let content = await file.text();
    let changed = false;

    for (const item of renameMap.values()) {
      if (content.includes(item.oldName)) {
        content = content.replaceAll(item.oldName, item.newName);
        changed = true;
      }
    }

    if (changed) {
      await Bun.write(mdFile, content);
    }
  }
}
