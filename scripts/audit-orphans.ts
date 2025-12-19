#!/usr/bin/env bun

import fsp from "node:fs/promises";
import path from "node:path";
import { confirm, intro, outro, spinner } from "@clack/prompts";
import type { Cache, ImageEntry } from "../src/lib/types/manifest";
import { config } from "./config";
import { findOrphanAssets, findOrphanFaceCrops, getOutputFolders } from "./lib/cleanup-utils";
import { resolveGalleryDirectory } from "./lib/gallery-resolver";
import { loadImagesManifest, loadManifest, loadPeopleManifest } from "./lib/manifest-repository";

interface AuditResults {
  orphanPersonFolders: string[];
  orphanFaceCrops: string[];
  orphanAssets: string[];
  staleCacheEntries: string[];
  staleConstraints: { imageId: string; type: string }[];
}

async function main() {
  intro("🔍 Orphan Audit");

  const fixMode = process.argv.includes("--fix");
  console.log(
    fixMode ? "Running in FIX mode - will remove orphans\n" : "Running in DRY-RUN mode\n",
  );

  const contentDir = await resolveGalleryDirectory();
  console.log(`Auditing gallery: ${contentDir}\n`);

  const dataDir = path.resolve(process.cwd(), `src/data/${contentDir}`);
  const staticDir = path.resolve(process.cwd(), `static/${contentDir}`);
  const facesDir = path.join(staticDir, "faces");
  const outputRoot = path.join(staticDir, "images");
  const cachePath = path.resolve(process.cwd(), `.temp/${contentDir}/images.cache.json`);
  const constraintsPath = path.join(dataDir, "clustering-constraints.json");

  const s = spinner();
  s.start("Loading manifests...");

  // Load manifests
  const imagesManifest = await loadImagesManifest(dataDir);
  const peopleManifest = await loadPeopleManifest(dataDir);
  const cache = await loadManifest<Cache>(cachePath);

  if (!imagesManifest) {
    s.stop("No images manifest found!");
    return;
  }

  // Build valid ID sets
  const validImageIds = new Set<string>();
  const validImageBaseNames = new Set<string>();
  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (item.type === "image") {
        const img = item as ImageEntry;
        validImageIds.add(img.id);
        validImageBaseNames.add(path.parse(img.src).name);
      }
    }
  }

  const validPersonIds = new Set<string>();
  if (peopleManifest) {
    for (const person of peopleManifest.people) {
      validPersonIds.add(person.id);
    }
  }

  s.stop(`Loaded: ${validImageIds.size} images, ${validPersonIds.size} people`);

  const results: AuditResults = {
    orphanPersonFolders: [],
    orphanFaceCrops: [],
    orphanAssets: [],
    staleCacheEntries: [],
    staleConstraints: [],
  };

  // 1. Check face crops
  s.start("Scanning face crops...");
  const faceCropResults = await findOrphanFaceCrops(facesDir, validPersonIds, validImageIds);
  results.orphanPersonFolders = faceCropResults.orphanFolders;
  results.orphanFaceCrops = faceCropResults.orphanFiles;
  s.stop(
    `Found ${results.orphanPersonFolders.length} orphan folders, ${results.orphanFaceCrops.length} orphan files`,
  );

  // 2. Check generated assets
  s.start("Scanning generated assets...");
  const outputFolders = getOutputFolders({
    outputs: config.outputs,
    formats: config.encoding.formats,
  });
  results.orphanAssets = await findOrphanAssets(outputRoot, outputFolders, validImageBaseNames);
  s.stop(`Found ${results.orphanAssets.length} orphan assets`);

  // 3. Check cache
  s.start("Checking cache...");
  if (cache && cache.files) {
    for (const key of Object.keys(cache.files)) {
      const baseName = path.parse(key).name;
      if (!validImageBaseNames.has(baseName)) {
        results.staleCacheEntries.push(key);
      }
    }
  }
  s.stop(`Found ${results.staleCacheEntries.length} stale cache entries`);

  // 4. Check constraints
  s.start("Checking constraints...");
  try {
    const constraintsData = await fsp.readFile(constraintsPath, "utf-8");
    const constraints = JSON.parse(constraintsData);

    if (constraints.disconnects) {
      for (const c of constraints.disconnects) {
        if (!validImageIds.has(c.imageId)) {
          results.staleConstraints.push({ imageId: c.imageId, type: "disconnect" });
        }
      }
    }
    if (constraints.connects) {
      for (const c of constraints.connects) {
        if (!validImageIds.has(c.imageId)) {
          results.staleConstraints.push({ imageId: c.imageId, type: "connect" });
        }
      }
    }
  } catch (e: any) {
    if (e.code !== "ENOENT") {
      console.warn(`Could not check constraints: ${e.message}`);
    }
  }
  s.stop(`Found ${results.staleConstraints.length} stale constraints`);

  // Print Summary
  console.log("\n" + "=".repeat(60));
  console.log("AUDIT SUMMARY");
  console.log("=".repeat(60));

  console.log(`\n📁 Orphan person folders: ${results.orphanPersonFolders.length}`);
  if (results.orphanPersonFolders.length > 0) {
    results.orphanPersonFolders.slice(0, 5).forEach((f) => console.log(`   - ${f}`));
    if (results.orphanPersonFolders.length > 5)
      console.log(`   ... and ${results.orphanPersonFolders.length - 5} more`);
  }

  console.log(`\n🖼️  Orphan face crop files: ${results.orphanFaceCrops.length}`);
  if (results.orphanFaceCrops.length > 0) {
    results.orphanFaceCrops.slice(0, 5).forEach((f) => console.log(`   - ${f}`));
    if (results.orphanFaceCrops.length > 5)
      console.log(`   ... and ${results.orphanFaceCrops.length - 5} more`);
  }

  console.log(`\n📦 Orphan generated assets: ${results.orphanAssets.length}`);
  if (results.orphanAssets.length > 0) {
    results.orphanAssets.slice(0, 5).forEach((f) => console.log(`   - ${f}`));
    if (results.orphanAssets.length > 5)
      console.log(`   ... and ${results.orphanAssets.length - 5} more`);
  }

  console.log(`\n🗃️  Stale cache entries: ${results.staleCacheEntries.length}`);
  if (results.staleCacheEntries.length > 0) {
    results.staleCacheEntries.slice(0, 5).forEach((f) => console.log(`   - ${f}`));
    if (results.staleCacheEntries.length > 5)
      console.log(`   ... and ${results.staleCacheEntries.length - 5} more`);
  }

  console.log(`\n⚙️  Stale constraints: ${results.staleConstraints.length}`);
  if (results.staleConstraints.length > 0) {
    results.staleConstraints
      .slice(0, 5)
      .forEach((c) => console.log(`   - ${c.imageId} (${c.type})`));
    if (results.staleConstraints.length > 5)
      console.log(`   ... and ${results.staleConstraints.length - 5} more`);
  }

  const totalOrphans =
    results.orphanPersonFolders.length +
    results.orphanFaceCrops.length +
    results.orphanAssets.length +
    results.staleCacheEntries.length +
    results.staleConstraints.length;

  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL: ${totalOrphans} orphan items found`);
  console.log("=".repeat(60) + "\n");

  // Fix mode
  if (fixMode && totalOrphans > 0) {
    const shouldFix = await confirm({
      message: `Delete ${totalOrphans} orphan items?`,
    });

    if (shouldFix) {
      const fixSpinner = spinner();
      fixSpinner.start("Removing orphans...");

      let removed = 0;

      // Remove orphan person folders
      for (const folder of results.orphanPersonFolders) {
        try {
          await fsp.rm(path.join(facesDir, folder), { recursive: true });
          removed++;
        } catch (e) {}
      }

      // Remove orphan face crops
      for (const file of results.orphanFaceCrops) {
        try {
          await fsp.unlink(path.join(facesDir, file));
          removed++;
        } catch (e) {}
      }

      // Remove orphan assets
      for (const file of results.orphanAssets) {
        try {
          await fsp.unlink(path.join(outputRoot, file));
          removed++;
        } catch (e) {}
      }

      // Clean cache
      if (cache && cache.files && results.staleCacheEntries.length > 0) {
        for (const key of results.staleCacheEntries) {
          delete cache.files[key];
          removed++;
        }
        await fsp.writeFile(cachePath, JSON.stringify(cache, null, 2));
      }

      // Clean constraints
      if (results.staleConstraints.length > 0) {
        try {
          const constraintsData = await fsp.readFile(constraintsPath, "utf-8");
          const constraints = JSON.parse(constraintsData);
          const staleIds = new Set(results.staleConstraints.map((c) => c.imageId));

          if (constraints.disconnects) {
            constraints.disconnects = constraints.disconnects.filter(
              (c: { imageId: string }) => !staleIds.has(c.imageId),
            );
          }
          if (constraints.connects) {
            constraints.connects = constraints.connects.filter(
              (c: { imageId: string }) => !staleIds.has(c.imageId),
            );
          }

          await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
          removed += results.staleConstraints.length;
        } catch (e) {}
      }

      fixSpinner.stop(`Removed ${removed} items`);
    }
  } else if (totalOrphans > 0) {
    console.log("Run with --fix to remove orphans");
  }

  outro(totalOrphans === 0 ? "✅ No orphans found!" : "Audit complete");
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
