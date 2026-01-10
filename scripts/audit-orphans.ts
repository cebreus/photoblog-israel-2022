#!/usr/bin/env bun

import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  spinner,
} from "@clack/prompts";
import path from "node:path";
import { parseArgs } from "node:util";
import pc from "picocolors";
import { type Cache, isImageEntry } from "../src/lib/types/manifest";
import { config } from "./build.config";
import { createLogger } from "$scripts/core/cli-logger";
import { findOrphanAssets, findOrphanFaceCrops, getOutputFolders } from "$scripts/gallery/cleanup";
import { resolveGalleryDirectory } from "$scripts/gallery/resolver";
import {
  loadAnalysisManifest,
  loadEmbeddingsManifest,
  loadFacesManifest,
  loadImagesManifest,
  loadManifest,
  loadPeopleManifest,
  saveAnalysisManifest,
  saveEmbeddingsManifest,
  saveFacesManifest,
  savePeopleManifest,
} from "$scripts/manifests/repository";
import { readFileText, rm, unlink, writeFile } from "$scripts/utils/runtime";

interface AuditResults {
  orphanPersonFolders: string[];
  orphanFaceCrops: string[];
  orphanAssets: string[];
  staleCacheEntries: string[];
  staleConstraints: { imageId: string; type: string }[];
  staleAnalysisEntries: string[];
  staleEmbeddingsEntries: string[];
  staleFacesEntries: string[];
  emptyPeople: string[];
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      yes: {
        type: "boolean",
        short: "y",
        default: false,
      },
      clean: {
        type: "string", // 'all' or comma-sep list like 'faces,cache'
        default: "",
      },
    },
    strict: false, // Allow other flags like content dir
  });

  intro(pc.cyan("🔍 Gallery Audit & Cleanup"));

  const contentDir = await resolveGalleryDirectory();
  note(`Auditing gallery: ${pc.bold(contentDir)}`, "Selected Gallery");

  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const staticDir = path.resolve(process.cwd(), `static-${contentDir}`);
  const facesDir = path.join(staticDir, "faces");
  const outputRoot = path.join(staticDir, "images");
  const cachePath = path.resolve(process.cwd(), `.temp/${contentDir}/images.cache.json`);
  const constraintsPath = path.join(dataDir, "clustering-constraints.json");

  const s = spinner();
  s.start("Loading manifests...");

  const imagesManifest = await loadImagesManifest(dataDir);
  const peopleManifest = await loadPeopleManifest(dataDir);
  const cache = await loadManifest<Cache>(cachePath);
  const analysisManifest = await loadAnalysisManifest(dataDir);
  const embeddingsManifest = await loadEmbeddingsManifest(dataDir);
  const facesManifest = await loadFacesManifest(dataDir);

  if (!imagesManifest) {
    logger.error({}, "No images manifest found!");
    process.exit(1);
  }

  // Actual face counts from images manifest
  const actualFaceCounts = new Map<string, number>();
  const validImageIds = new Set<string>();
  const validImageBaseNames = new Set<string>();

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (isImageEntry(item)) {
        validImageIds.add(item.id);
        validImageBaseNames.add(path.parse(item.src).name);

        if (item.people) {
          for (const pid of item.people) {
            actualFaceCounts.set(pid, (actualFaceCounts.get(pid) || 0) + 1);
          }
        }
      }
    }
  }

  const validPersonIds = new Set<string>();
  if (peopleManifest) {
    for (const person of peopleManifest.people) {
      validPersonIds.add(person.id);
    }
  }

  s.stop(
    `Loaded ${pc.green(validImageIds.size)} images and ${pc.green(validPersonIds.size)} people`,
  );

  const results: AuditResults = {
    orphanPersonFolders: [],
    orphanFaceCrops: [],
    orphanAssets: [],
    staleCacheEntries: [],
    staleConstraints: [],
    staleAnalysisEntries: [],
    staleEmbeddingsEntries: [],
    staleFacesEntries: [],
    emptyPeople: [],
  };

  // 1. Check face crops
  s.start("Checking face crops...");
  const faceCropResults = await findOrphanFaceCrops(facesDir, validPersonIds, validImageIds);
  results.orphanPersonFolders = faceCropResults.orphanFolders;
  results.orphanFaceCrops = faceCropResults.orphanFiles;
  s.stop(
    `Face crops: ${pc.yellow(results.orphanPersonFolders.length)} orphan folders, ${pc.yellow(results.orphanFaceCrops.length)} orphan files`,
  );

  // 2. Check generated assets
  s.start("Checking generated assets...");
  const outputFolders = getOutputFolders({
    outputs: config.outputs,
    formats: config.encoding.formats,
  });
  results.orphanAssets = await findOrphanAssets(outputRoot, outputFolders, validImageBaseNames);
  s.stop(`Assets: ${pc.yellow(results.orphanAssets.length)} orphans`);

  // 3. Check cache
  s.start("Checking images cache...");
  if (cache?.files) {
    for (const key of Object.keys(cache.files)) {
      const baseName = path.parse(key).name;
      if (!validImageBaseNames.has(baseName)) {
        results.staleCacheEntries.push(key);
      }
    }
  }
  s.stop(`Cache: ${pc.yellow(results.staleCacheEntries.length)} stale entries`);

  // 4. Check analysis/embeddings/faces manifests
  s.start("Checking sub-manifests...");
  if (analysisManifest) {
    for (const id of Object.keys(analysisManifest)) {
      if (!validImageIds.has(id)) results.staleAnalysisEntries.push(id);
    }
  }
  if (embeddingsManifest) {
    for (const id of Object.keys(embeddingsManifest)) {
      if (!validImageIds.has(id)) results.staleEmbeddingsEntries.push(id);
    }
  }
  if (facesManifest) {
    for (const id of Object.keys(facesManifest)) {
      if (!validImageIds.has(id)) results.staleFacesEntries.push(id);
    }
  }
  s.stop(
    `Manifests: ${pc.yellow(results.staleAnalysisEntries.length + results.staleEmbeddingsEntries.length + results.staleFacesEntries.length)} stale entries`,
  );

  // 5. Check constraints
  s.start("Checking constraints...");
  try {
    const data = await readFileText(constraintsPath);
    const constraints = JSON.parse(data);
    if (constraints.disconnects) {
      for (const c of constraints.disconnects) {
        if (!validImageIds.has(c.imageId))
          results.staleConstraints.push({ imageId: c.imageId, type: "disconnect" });
      }
    }
    if (constraints.connects) {
      for (const c of constraints.connects) {
        if (!validImageIds.has(c.imageId))
          results.staleConstraints.push({ imageId: c.imageId, type: "connect" });
      }
    }
  } catch {}
  s.stop(`Constraints: ${pc.yellow(results.staleConstraints.length)} stale references`);

  // 6. Check for empty people (0 faces)
  s.start("Checking for empty people...");
  if (peopleManifest?.people) {
    for (const person of peopleManifest.people) {
      if ((actualFaceCounts.get(person.id) || 0) === 0) {
        results.emptyPeople.push(person.id);
      }
    }
  }
  s.stop(`Empty profiles: ${pc.yellow(results.emptyPeople.length)} found`);

  const total =
    results.orphanPersonFolders.length +
    results.orphanFaceCrops.length +
    results.orphanAssets.length +
    results.staleCacheEntries.length +
    results.staleAnalysisEntries.length +
    results.staleEmbeddingsEntries.length +
    results.staleFacesEntries.length +
    results.staleConstraints.length +
    results.emptyPeople.length;

  if (total === 0) {
    outro(pc.green("✨ Everything clean. No orphans found!"));
    return;
  }

  note(
    `Found ${pc.bold(total)} items to clean up:\n` +
      `  • Person folders: ${results.orphanPersonFolders.length}\n` +
      `  • Face crops: ${results.orphanFaceCrops.length}\n` +
      `  • Generated images: ${results.orphanAssets.length}\n` +
      `  • Cache entries: ${results.staleCacheEntries.length}\n` +
      `  • Manifest entries: ${results.staleAnalysisEntries.length + results.staleEmbeddingsEntries.length + results.staleFacesEntries.length}\n` +
      `  • Stale constraints: ${results.staleConstraints.length}\n` +
      `  • Empty profiles: ${results.emptyPeople.length}`,
    "Audit Report",
  );

  const options = [
    {
      value: "faces",
      label: "Face Crops & Folders",
      hint: `${results.orphanPersonFolders.length} folders, ${results.orphanFaceCrops.length} files`,
    },
    { value: "assets", label: "Generated Images", hint: `${results.orphanAssets.length} files` },
    { value: "cache", label: "Build Cache", hint: `${results.staleCacheEntries.length} entries` },
    {
      value: "manifests",
      label: "Special Manifests",
      hint: `${results.staleAnalysisEntries.length + results.staleEmbeddingsEntries.length + results.staleFacesEntries.length} entries`,
    },
    {
      value: "constraints",
      label: "Clustering Constraints",
      hint: `${results.staleConstraints.length} entries`,
    },
    {
      value: "empty-people",
      label: "Empty People Profiles",
      hint: `${results.emptyPeople.length} people with 0 photos`,
    },
  ].filter((opt) => {
    if (opt.value === "faces")
      return results.orphanPersonFolders.length > 0 || results.orphanFaceCrops.length > 0;
    if (opt.value === "assets") return results.orphanAssets.length > 0;
    if (opt.value === "cache") return results.staleCacheEntries.length > 0;
    if (opt.value === "manifests")
      return (
        results.staleAnalysisEntries.length +
          results.staleEmbeddingsEntries.length +
          results.staleFacesEntries.length >
        0
      );
    if (opt.value === "constraints") return results.staleConstraints.length > 0;
    if (opt.value === "empty-people") return results.emptyPeople.length > 0;
    return false;
  });

  let selected: string[] | symbol = [];

  if (values.clean === "all") {
    selected = options.map((o) => o.value);
  } else if (typeof values.clean === "string" && values.clean.length > 0) {
    const requested = values.clean.split(",");
    selected = options.filter((o) => requested.includes(o.value)).map((o) => o.value);
  } else {
    selected = await multiselect({
      message: "Select categories to clean up:",
      options,
      initialValues: options.map((opt) => opt.value),
      required: false,
    });
  }

  if (isCancel(selected)) {
    cancel("Audit cancelled.");
    process.exit(0);
  }

  if (!selected || (Array.isArray(selected) && selected.length === 0)) {
    outro("No categories selected. Nothing to clean.");
    return;
  }

  // Ensure confirmed is strictly boolean or symbol
  let confirmed: boolean | symbol = Boolean(values.yes);

  // prompt only if not pre-confirmed
  if (!values.yes) {
    confirmed = await confirm({
      message: pc.red(`Permanently delete items from ${(selected as string[]).length} categories?`),
      initialValue: false,
    });
  }

  if (isCancel(confirmed) || !confirmed) {
    cancel("Operation aborted.");
    process.exit(0);
  }

  s.start("Cleaning up...");
  let removed = 0;
  const categories = selected as string[];

  if (categories.includes("faces")) {
    for (const folder of results.orphanPersonFolders) {
      await rm(path.join(facesDir, folder), { recursive: true });
      removed++;
    }
    for (const file of results.orphanFaceCrops) {
      await unlink(path.join(facesDir, file)).catch(() => {});
      removed++;
    }
  }

  if (categories.includes("assets")) {
    for (const file of results.orphanAssets) {
      await unlink(path.join(outputRoot, file)).catch(() => {});
      removed++;
    }
  }

  if (categories.includes("cache") && cache?.files) {
    for (const key of results.staleCacheEntries) {
      delete cache.files[key];
      removed++;
    }
    await writeFile(cachePath, JSON.stringify(cache, null, 2));
  }

  if (categories.includes("manifests")) {
    if (analysisManifest && results.staleAnalysisEntries.length > 0) {
      for (const id of results.staleAnalysisEntries) delete analysisManifest[id];
      await saveAnalysisManifest(dataDir, analysisManifest);
      removed += results.staleAnalysisEntries.length;
    }
    if (embeddingsManifest && results.staleEmbeddingsEntries.length > 0) {
      for (const id of results.staleEmbeddingsEntries) delete embeddingsManifest[id];
      await saveEmbeddingsManifest(dataDir, embeddingsManifest);
      removed += results.staleEmbeddingsEntries.length;
    }
    if (facesManifest && results.staleFacesEntries.length > 0) {
      for (const id of results.staleFacesEntries) delete facesManifest[id];
      await saveFacesManifest(dataDir, facesManifest);
      removed += results.staleFacesEntries.length;
    }
  }

  if (categories.includes("constraints")) {
    try {
      const data = await readFileText(constraintsPath);
      const constraints = JSON.parse(data);
      const staleIds = new Set(results.staleConstraints.map((c) => c.imageId));
      if (constraints.disconnects)
        constraints.disconnects = constraints.disconnects.filter(
          (c: any) => !staleIds.has(c.imageId),
        );
      if (constraints.connects)
        constraints.connects = constraints.connects.filter((c: any) => !staleIds.has(c.imageId));
      await writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
      removed += results.staleConstraints.length;
    } catch {}
  }

  if (categories.includes("empty-people") && peopleManifest) {
    const staleIds = new Set(results.emptyPeople);
    peopleManifest.people = peopleManifest.people.filter((p) => !staleIds.has(p.id));
    await savePeopleManifest(dataDir, peopleManifest);
    removed += results.emptyPeople.length;
  }

  s.stop(pc.green(`Successfully removed ${removed} items.`));
  outro(pc.cyan("Done! Archive is now clean."));
}

const logger = createLogger("audit-orphans");

main().catch((err: any) => {
  logger.error({ err }, "Fatal Error");
  process.exit(1);
});
