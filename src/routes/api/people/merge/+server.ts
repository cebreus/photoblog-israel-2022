import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { clearTaskStatus, saveTaskStatus } from "$lib/server/task-status";
import {
  type FacesManifest,
  type ImageEntry,
  isImageEntry,
  type Manifest,
  type Person,
} from "$lib/types/manifest";
import { validateMergeInput } from "$lib/utils/api-validators";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { toSlug } from "$lib/utils/strings";
import { config } from "$scripts/build.config";
import type { Logger as ScriptLogger } from "$scripts/lib/core/cli-logger";
import { mergeClusters } from "$scripts/lib/faces/clustering";
import { migratePersonInConstraints } from "$scripts/lib/faces/constraints";
import { recalculateFaceCount, refreshPersonThumbnail } from "$scripts/lib/faces/people";
import { removeEmptyPersonFolder } from "$scripts/lib/gallery/cleanup";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadFacesManifest,
  loadImagesManifest,
  loadPeopleManifest,
  saveFacesManifest,
  saveImagesManifest,
  savePeopleManifest,
} from "$scripts/lib/manifests/repository";

async function safeRename(
  oldPath: string,
  newPath: string,
  log: Array<{ from: string; to: string }>,
) {
  try {
    await fsp.rename(oldPath, newPath);
    log.push({ from: oldPath, to: newPath });
  } catch (e) {
    // Standard behavior in this module is to ignore missing files (ENOENT)
    // but propagate other errors (EPERM etc)
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw e;
    }
  }
}

async function renamePhysicalFiles(
  item: ImageEntry,
  oldId: string,
  newId: string,
  picsDir: string,
  imagesDir: string,
  log: Array<{ from: string; to: string }>,
) {
  // 1. Rename original content file
  if (item.src) {
    const ext = path.extname(item.src);
    const oldPath = path.resolve(picsDir, `${oldId}${ext}`);
    const newPath = path.resolve(picsDir, `${newId}${ext}`);
    await safeRename(oldPath, newPath, log);
  }

  // 2. Rename generated assets
  for (const output of Object.values(config.outputs)) {
    if (output.kind === "variant") {
      // Variants are generated in all configured formats
      for (const format of config.encoding.formats) {
        const suffix = format === "jpeg" ? "" : `-${format}`;
        const folder = `${output.folderName}${suffix}`;
        const ext = `.${format === "jpeg" ? "jpeg" : format}`;

        const oldAsset = path.resolve(imagesDir, folder, `${oldId}${ext}`);
        const newAsset = path.resolve(imagesDir, folder, `${newId}${ext}`);
        await safeRename(oldAsset, newAsset, log);
      }
    } else {
      // 'other' outputs (detail, placeholder, admin_thumb)
      const format = "format" in output && output.format ? output.format : "jpeg";
      const ext = `.${format === "jpeg" ? "jpeg" : format}`;
      const oldAsset = path.resolve(imagesDir, output.folderName, `${oldId}${ext}`);
      const newAsset = path.resolve(imagesDir, output.folderName, `${newId}${ext}`);
      await safeRename(oldAsset, newAsset, log);
    }
  }
}

async function renameFaceCrops(
  item: ImageEntry,
  oldId: string,
  newId: string,
  facesDir: string,
  log: Array<{ from: string; to: string }>,
) {
  if (item.people) {
    for (const personId of item.people) {
      await safeRename(
        path.resolve(facesDir, personId, `${oldId}.jpg`),
        path.resolve(facesDir, personId, `${newId}.jpg`),
        log,
      );
    }
  }
}

function updateEntryMetadata(
  item: ImageEntry,
  oldId: string,
  newId: string,
  facesManifest: FacesManifest,
) {
  item.id = newId;

  if (item.src) item.src = item.src.replace(oldId, newId);
  if (item.sources) {
    for (const source of item.sources) {
      if (source.path) source.path = source.path.replace(oldId, newId);
    }
  }

  if (facesManifest[oldId]) {
    facesManifest[newId] = facesManifest[oldId];
    delete facesManifest[oldId];
  }
}

/**
 * Handles complex renaming of images that are linked to the merged person.
 * This ensures file naming consistency (e.g. 2024-Dasa.jpg -> 2024-Honza.jpg).
 */
async function processDeepRename(
  imagesManifest: Manifest,
  facesManifest: FacesManifest,
  sourcePerson: Person,
  targetPerson: Person,
  picsDir: string,
  imagesDir: string,
  facesDir: string,
  log: Array<{ from: string; to: string }>,
) {
  const sourceSlug = toSlug(sourcePerson.name);
  const targetSlug = toSlug(targetPerson.name);
  if (!sourceSlug || !targetSlug || sourceSlug === targetSlug) return;

  const slugRegex = new RegExp(`(-|^)${sourceSlug}$`);

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item)) continue;
      if (!item.people?.includes(sourcePerson.id) || !slugRegex.test(item.id)) continue;

      const newId = item.id.replace(slugRegex, `$1${targetSlug}`);
      if (newId === item.id) continue;

      const oldId = item.id;

      await renamePhysicalFiles(item, oldId, newId, picsDir, imagesDir, log);
      await renameFaceCrops(item, oldId, newId, facesDir, log);
      updateEntryMetadata(item, oldId, newId, facesManifest);
    }
  }
}

/**
 * Standard merge logic for assignments and faceCrop files.
 */
async function mergeAssignments(
  imagesManifest: Manifest,
  facesManifest: FacesManifest,
  sourceId: string,
  targetId: string,
  facesDir: string,
  log: Array<{ from: string; to: string }>,
) {
  const sourceDir = path.resolve(facesDir, sourceId);
  const targetDir = path.resolve(facesDir, targetId);
  await fsp.mkdir(targetDir, { recursive: true });

  for (const day of imagesManifest.photoDays) {
    for (const item of day.items) {
      if (!isImageEntry(item)) continue;
      if (!item.people?.includes(sourceId)) continue;

      // Move faceCrop
      await safeRename(
        path.resolve(sourceDir, `${item.id}.jpg`),
        path.resolve(targetDir, `${item.id}.jpg`),
        log,
      );

      // Update refs
      item.people = item.people.map((personId) => (personId === sourceId ? targetId : personId));
      item.people = [...new Set(item.people)];

      if (facesManifest[item.id]) {
        const faceData = facesManifest[item.id];
        if (faceData.peopleIds?.includes(sourceId)) {
          faceData.peopleIds = faceData.peopleIds.map((personId) =>
            personId === sourceId ? targetId : personId,
          );
          faceData.peopleIds = [...new Set(faceData.peopleIds)];
        }
      }
    }
  }
}

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const { log, logContext } = locals;
  if (!dev) throw error(403, "Dev mode only.");

  const body = await request.json();
  const validation = validateMergeInput(body);
  if (!validation.valid) return json({ success: false, error: validation.error }, { status: 400 });

  const { sourcePersonId, sourcePersonIds, targetPersonId } = validation.data;
  const sources = sourcePersonIds || (sourcePersonId ? [sourcePersonId] : []);
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const facesDir = path.resolve(process.cwd(), `static-${contentDir}`, "faces");
  const imagesDir = path.resolve(process.cwd(), `static-${contentDir}`, "images");
  const picsDir = path.resolve(process.cwd(), `content/${contentDir}/pics`);

  // Adapt backend logger to script logger interface
  const scriptLog = {
    error: log.error.bind(log),
    warn: log.warn.bind(log),
    info: log.info.bind(log),
    debug: log.debug.bind(log),
    verbose: log.debug.bind(log), // Map verbose to debug
    raw: (msg: string) => log.info({ raw: msg }, "SCRIPT_OUTPUT"),
    silent: false,
    level: log.level,
  } as unknown as ScriptLogger;

  // Set task status before starting
  await saveTaskStatus(dataDir, {
    id: "person-merge",
    label: "Slučování osob...",
  });

  try {
    return await withManifestLock(dataDir, async () => {
      const peopleManifest = await loadPeopleManifest(dataDir, scriptLog);
      const imagesManifest = await loadImagesManifest(dataDir, scriptLog);
      const facesManifest = (await loadFacesManifest(dataDir, scriptLog)) || {};

      if (!peopleManifest || !imagesManifest) throw new Error("Manifests missing.");

      const targetPerson = peopleManifest.people.find((person) => person.id === targetPersonId);
      if (!targetPerson) throw new Error("Target person not found.");

      const transactionLog: Array<{ from: string; to: string }> = [];

      try {
        for (const sourceId of sources) {
          const sourcePerson = peopleManifest.people.find((person) => person.id === sourceId);
          if (!sourcePerson) continue;

          await processDeepRename(
            imagesManifest,
            facesManifest,
            sourcePerson,
            targetPerson,
            picsDir,
            imagesDir,
            facesDir,
            transactionLog,
          );
          await mergeAssignments(
            imagesManifest,
            facesManifest,
            sourceId,
            targetPersonId,
            facesDir,
            transactionLog,
          );
          await migratePersonInConstraints(dataDir, sourceId, targetPersonId, scriptLog);

          // Merge clusters with weighted centroids
          if (sourcePerson.clusters?.length) {
            const allClusters = [...(targetPerson.clusters || []), ...sourcePerson.clusters];
            const merged = mergeClusters(allClusters);
            targetPerson.clusters = [merged];
            targetPerson.faceDescriptor = merged.centroid;
          }

          // Cleanup source
          if (sourcePerson.isUserNamed) {
            targetPerson.isUserNamed = true;
          }
          peopleManifest.people = peopleManifest.people.filter((person) => person.id !== sourceId);
          await removeEmptyPersonFolder(facesDir, sourceId, scriptLog);
        }

        // Recalculate faceCount authoritatively
        targetPerson.faceCount = recalculateFaceCount(targetPersonId, imagesManifest);

        // Ensure target person has a valid thumbnail (especially if it was empty or changed)
        await refreshPersonThumbnail(targetPerson, facesDir);

        await savePeopleManifest(dataDir, peopleManifest, scriptLog);
        await saveImagesManifest(dataDir, imagesManifest, scriptLog);
        await saveFacesManifest(dataDir, facesManifest, scriptLog);

        // Force reload of in-memory manifest cache
        await reloadManifests();

        logContext.targetPersonId = targetPersonId;
        logContext.sourcePersonIds = sources;
        logContext.mergedFaceCount = targetPerson.faceCount;
        return json({ success: true, count: targetPerson.faceCount });
      } catch (err) {
        // Rollback
        if (transactionLog.length > 0) {
          log.warn(
            { rollbackCount: transactionLog.length },
            "MERGE: Error, rolling back file moves",
          );
          for (const logEntry of transactionLog.reverse()) {
            try {
              await fsp.rename(logEntry.to, logEntry.from);
            } catch (rollbackErr) {
              log.error(
                { err: rollbackErr, from: logEntry.to, to: logEntry.from },
                "MERGE: Rollback failed",
              );
            }
          }
        }
        throw err;
      }
    });
  } catch (err) {
    log.error({ err }, "[API/PEOPLE/MERGE] Error");
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await clearTaskStatus(dataDir);
  }
}
