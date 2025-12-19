import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { Cache } from "../../src/lib/types/manifest";
import { toSlug } from "../../src/lib/utils/strings";
import { config } from "../config";
import { getOutputFolders } from "./cleanup-utils";
import {
  loadCurationManifest,
  loadImagesManifest,
  loadManifest,
  loadPeopleManifest,
  saveCurationManifest,
  saveImagesManifest,
  saveManifest,
  savePeopleManifest,
} from "./manifest-repository";
import { type RenameMap, safeRename } from "./renaming-utils";

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
      if (!fs.existsSync(dir)) continue;

      for (const format of outputFormats) {
        const oldVariant = path.join(dir, `${item.oldBase}.${format}`);
        const newVariant = path.join(dir, `${item.newBase}.${format}`);

        if (fs.existsSync(oldVariant)) {
          await safeRename(oldVariant, newVariant);
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
    }
    if (peopleChanged) {
      await savePeopleManifest(`src/data/${gallery}`, peopleManifest);
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
    let content = await fsp.readFile(mdFile, "utf-8");
    let changed = false;

    for (const item of renameMap.values()) {
      if (content.includes(item.oldName)) {
        content = content.replaceAll(item.oldName, item.newName);
        changed = true;
      }
    }

    if (changed) {
      await fsp.writeFile(mdFile, content, "utf-8");
    }
  }
}
