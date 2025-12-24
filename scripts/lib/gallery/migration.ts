import path from "node:path";
import fg from "fast-glob";
import { toSlug } from "../../../shared/utils/strings";
import type { Cache } from "../../../src/lib/types/manifest";
import { config } from "../../build.config";
import {
  loadCurationManifest,
  loadFacesManifest,
  loadImagesManifest,
  loadManifest,
  loadPeopleManifest,
  saveCurationManifest,
  saveFacesManifest,
  saveImagesManifest,
  saveManifest,
  savePeopleManifest,
} from "../manifests/repository";
import { getOutputFolders } from "./cleanup";
import { type RenameMap, safeRename } from "./renaming";

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
      // NOTE: Bun doesn't have a direct equivalent for blocking directory existence check easily
      // However, for this script, we can rely on node:fs/promises or just ignore the check if safe
      // But adhering to the rule: prevent fs.*Sync.
      // Since this is a migration script, async is fine.
      if (!(await Bun.file(dir).exists()) && !(await Bun.file(path.join(dir, ".keep")).exists())) {
        // Bun.file(dir).exists() returns false for directories usually.
        // We should use import("node:fs/promises").
        const exists = await import("node:fs/promises").then((fs) =>
          fs
            .access(dir)
            .then(() => true)
            .catch(() => false),
        );
        if (!exists) continue;
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
    if (
      await import("node:fs/promises").then((fs) =>
        fs
          .access(facesRootDir)
          .then(() => true)
          .catch(() => false),
      )
    ) {
      const personDirs = await import("node:fs/promises").then((fs) => fs.readdir(facesRootDir));
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

export async function migrateCache(gallery: string, renameMap: RenameMap): Promise<void> {
  const cachePath = path.resolve(`.temp/${gallery}/images.cache.json`);
  const cache = await loadManifest<Cache>(cachePath);

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
    await saveManifest(cachePath, cache);
  }
}

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

export async function migrateFacesManifest(gallery: string, renameMap: RenameMap): Promise<void> {
  const facesManifest = await loadFacesManifest(`src/data/${gallery}`);
  if (facesManifest) {
    const newManifest: any = {};
    let changed = false;

    // Build lookup for slugified IDs
    const lookup = new Map<string, string>();
    for (const v of renameMap.values()) {
      lookup.set(toSlug(v.oldBase), v.newBase); // Use newBase for key
    }

    for (const [oldId, data] of Object.entries(facesManifest)) {
      const match = lookup.get(oldId);
      if (match) {
        newManifest[toSlug(match)] = data;
        changed = true;
      } else {
        newManifest[oldId] = data;
      }
    }

    if (changed) {
      await saveFacesManifest(`src/data/${gallery}`, newManifest);
    }
  }
}

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
