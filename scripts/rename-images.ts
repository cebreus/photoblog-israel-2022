import { confirm, intro, outro, select, spinner, text } from "@clack/prompts";
import { exiftool } from "exiftool-vendored";
import fg from "fast-glob";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ImageFormat } from "../src/lib/types/images";
import type { Cache } from "../src/lib/types/manifest";
import { toSlug } from "../src/lib/utils/strings";
import { config } from "./config";
import {
  loadCurationManifest,
  loadImagesManifest,
  loadManifest,
  loadPeopleManifest,
  saveCurationManifest,
  saveImagesManifest,
  saveManifest,
  savePeopleManifest,
} from "./lib/manifest-repository";

// Typings for our migration maps
type RenameMap = Map<
  string,
  {
    oldName: string;
    newName: string;
    oldPath: string;
    newPath: string;
    oldBase: string;
    newBase: string;
    oldRelPath: string;
    newRelPath: string;
  }
>;

// Exported for testing
export function getNewBasename(
  tags: any,
  defaultAuthor: string,
  originalBasename: string = "",
): string {
  let dateStr = "0000-00-00-000000";
  const dateObj = tags.DateTimeOriginal || tags.CreateDate;
  if (dateObj) {
    try {
      // @ts-ignore
      const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj.toString());
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const HH = String(d.getHours()).padStart(2, "0");
        const Min = String(d.getMinutes()).padStart(2, "0");
        const Sec = String(d.getSeconds()).padStart(2, "0");
        dateStr = `${yyyy}-${mm}-${dd}-${HH}${Min}${Sec}`;
      }
    } catch (e) {}
  }

  let author = defaultAuthor;
  const metaAuthor = tags.Artist || tags.Creator || tags["By-line"] || tags.Author;
  if (metaAuthor) {
    author = Array.isArray(metaAuthor) ? metaAuthor[0] : String(metaAuthor);
  }
  author = toSlug(author);

  if (!author) {
    return originalBasename ? `${dateStr}-${toSlug(originalBasename)}` : dateStr;
  }

  return `${dateStr}-${author}`;
}

async function getGalleries() {
  const contentDir = path.resolve("content");
  const entries = await fsp.readdir(contentDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function safeRename(oldPath: string, newPath: string) {
  if (oldPath === newPath) return;
  try {
    await fsp.rename(oldPath, newPath);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      // source doesn't exist, maybe already renamed or missing?
      // console.warn(`Skipping rename, source missing: ${oldPath}`);
    } else {
      throw e;
    }
  }
}

async function main() {
  intro("🖼️  Smart Image Renamer");

  // 1. Select Gallery
  const galleries = await getGalleries();
  if (galleries.length === 0) {
    outro("No galleries found in content/.");
    return;
  }

  const galleryIds = await select({
    message: "Select a gallery to rename images in:",
    options: galleries.map((g) => ({ value: g, label: g })),
  });

  if (typeof galleryIds !== "string") {
    outro("Operation cancelled.");
    process.exit(0);
  }
  const gallery = galleryIds;

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

  // 2. Analyze Maps
  const files = await fg("*.{jpg,jpeg,png,webp,avif,heic}", {
    cwd: picsDir,
    absolute: true,
    deep: 1, // Only current directory, no subfolders
    caseSensitiveMatch: false,
  });
  const renameMap: RenameMap = new Map();
  const usedNames = new Set<string>();

  for (const file of files) {
    const ext = path.extname(file);
    const oldName = path.basename(file);
    const tags = await exiftool.read(file);

    const oldBase = path.basename(oldName, ext);
    let baseNewName = getNewBasename(tags, defaultAuthor, oldBase);

    let candidateName = `${baseNewName}${ext.toLowerCase()}`;

    // Ensure uniqueness
    let counter = 1;
    while (
      usedNames.has(candidateName) ||
      (candidateName !== oldName && fs.existsSync(path.join(picsDir, candidateName)))
    ) {
      // Check if fs exists too, in case we are renaming to existing file?
      // We only care about collisions within our SET of targets really, but safety first.
      candidateName = `${baseNewName}-${counter}${ext.toLowerCase()}`;
      counter++;
    }

    usedNames.add(candidateName);

    // Skip if name is same (already renamed)
    if (candidateName !== oldName) {
      renameMap.set(file, {
        oldName,
        newName: candidateName,
        oldPath: file,
        newPath: path.join(path.dirname(file), candidateName),
        oldBase: path.basename(oldName, path.extname(oldName)),
        newBase: path.basename(candidateName, path.extname(candidateName)),
        oldRelPath: path.relative(picsDir, file), // usually just filename if flat
        newRelPath: path.join(path.dirname(path.relative(picsDir, file)), candidateName), // preserve subdirs if any
      });
    }
  }

  await exiftool.end();
  s.stop(`Analyzed ${files.length} files.`);

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

  const sRun = spinner();
  sRun.start("Renaming and Migrating...");

  // 3. Perform Renames & Migration

  // A. Rename Source Files
  for (const item of renameMap.values()) {
    await safeRename(item.oldPath, item.newPath);
  }

  // B. Rename Generated Assets (static/)
  // Config outputs define folders like previews, previews-xl, etc.
  const staticParams = {
    outRoot: `static/${gallery}/images`,
    tmpRoot: `.temp/${gallery}`,
  };

  // Dynamically determine output folders from config
  const outputFolders: string[] = [];

  // Iterate over configured outputs
  for (const [key, conf] of Object.entries(config.outputs)) {
    if (conf.folderName) {
      outputFolders.push(conf.folderName);

      // If it's a variant (kind: "variant"), it likely has specific format subfolders (e.g. -webp, -avif)
      // based on config.encoding.formats.
      // BUT: The generator logic (image-processor) appends suffix only if the format differs from default or if strictly configured.
      // Let's look at how directories are structured. Usually:
      // - previews/ (default format, usually jpg)
      // - previews-webp/
      // - previews-avif/

      if (conf.kind === "variant") {
        for (const fmt of config.encoding.formats) {
          if (fmt === ImageFormat.JPEG) continue; // usually default folder
          outputFolders.push(`${conf.folderName}-${fmt}`);
        }
      }
    }
  }

  // Also outputFormats should come from config
  const outputFormats = [...config.encoding.formats, "jpg", "png"]; // ensure basic ones

  // We iterate renameMap and for each file, try to rename its variants
  for (const item of renameMap.values()) {
    for (const folder of outputFolders) {
      const dir = path.join(staticParams.outRoot, folder);
      if (!fs.existsSync(dir)) continue;

      // Try all likely variants
      for (const format of outputFormats) {
        // Construct possible old filenames
        // e.g. oldBase.webp
        const oldVariant = path.join(dir, `${item.oldBase}.${format}`);
        const newVariant = path.join(dir, `${item.newBase}.${format}`);

        if (fs.existsSync(oldVariant)) {
          await safeRename(oldVariant, newVariant);
        }
      }
    }
  }

  // C. Migrate Cache (.temp/.../images.cache.json)
  const cachePath = path.resolve(`.temp/${gallery}/images.cache.json`);
  const cache = await loadManifest<Cache>(cachePath);

  if (cache && cache.files) {
    for (const item of renameMap.values()) {
      const oldKey = item.oldRelPath; // relative to pics/ usually
      const newKey = item.newRelPath;

      if (cache.files[oldKey]) {
        const entry = cache.files[oldKey];
        // Update outputs list
        entry.outputs = entry.outputs.map((outPath) => {
          // outPath is relative to something? usually "previews/img.webp"
          // replace basename
          const dir = path.dirname(outPath);
          const ext = path.extname(outPath);
          const oldBase = path.basename(outPath, ext);
          // Only replace if base matches oldBase exactly?
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

  // D. Migrate Images Manifest
  const manifestPath = `src/data/${gallery}/images.manifest.json`;
  const manifest = await loadImagesManifest(`src/data/${gallery}`); // load helper expects dir

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
            // Update ImageEntry
            item.src = match.newName;
            item.id = toSlug(match.newBase); // ID usually slug of base

            // Update sources
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

  // E. Migrate People Manifest
  const peopleManifest = await loadPeopleManifest(`src/data/${gallery}`);
  if (peopleManifest) {
    const lookup = new Map<string, typeof renameMap extends Map<any, infer V> ? V : never>();
    for (const v of renameMap.values()) {
      // Match by old slug ID
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

  // F. Migrate Curation Manifest
  const curationManifest = await loadCurationManifest(`src/data/${gallery}`);
  if (curationManifest) {
    const lookup = new Map<string, typeof renameMap extends Map<any, infer V> ? V : never>();
    for (const v of renameMap.values()) {
      // Match by old slug ID
      lookup.set(toSlug(v.oldBase), v);
    }

    let curChanged = false;
    for (const group of curationManifest.groups) {
      // Items
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

      // Best Candidate
      const matchBest = lookup.get(group.bestCandidateId);
      if (matchBest) {
        group.bestCandidateId = toSlug(matchBest.newBase);
        curChanged = true;
      }

      // Recommendations keys?
      // `recommendations: Record<string, ...>` -> key is image ID
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

  // G. Update Markdown Files
  const mdFiles = await fg("**/*.md", { cwd: path.resolve(`content/${gallery}`), absolute: true });
  for (const mdFile of mdFiles) {
    let content = await fsp.readFile(mdFile, "utf-8");
    let changed = false;

    for (const item of renameMap.values()) {
      // Replace `oldName` with `newName`
      // Be strict? `(oldName)` or `src="oldName"`?
      // Usually `![alt](oldName)` or `src="oldName"`
      // Simple replaceAll might be dangerous if name is short/common, but they are filenames.

      if (content.includes(item.oldName)) {
        content = content.replaceAll(item.oldName, item.newName);
        changed = true;
      }
    }

    if (changed) {
      await fsp.writeFile(mdFile, content, "utf-8");
    }
  }

  sRun.stop(`Successfully processed ${renameMap.size} files.`);

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

// Only run if called directly
if (import.meta.main) {
  main().catch(console.error);
}
