import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { clearTaskStatus, saveTaskStatus } from "$lib/server/task-status";
import { type PeopleManifest, type Person } from "$lib/types/manifest";
import { validateUnmatchInput } from "$lib/utils/api-validators";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { toSlug } from "$lib/utils/strings";
import type { Logger as ScriptLogger } from "$scripts/lib/core/cli-logger";
import { addReassignmentConstraints } from "$scripts/lib/faces/constraints";
import {
  recalculateFaceCount,
  refreshPersonThumbnail,
  updateImagePersonReference,
} from "$scripts/lib/faces/people";
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

function createNewPerson(
  peopleManifest: PeopleManifest,
  sourcePerson: Person,
  imgId: string,
  shouldHide: boolean,
): Person {
  // Prevent nested "Odpojeno od..." names
  let baseName: string;

  if (sourcePerson.name.startsWith("Odpojeno od ")) {
    // Extract the original name (e.g., "Odpojeno od Dáša" -> "Dáša")
    baseName = sourcePerson.name.replace(/^Odpojeno od /, "");
  } else {
    baseName = sourcePerson.name;
  }

  // Check if "Odpojeno od {baseName}" already exists
  const existingNames = peopleManifest.people
    .filter((p) => p.name.startsWith(`Odpojeno od ${baseName}`))
    .map((p) => p.name);

  let name: string;
  if (existingNames.length === 0) {
    name = `Odpojeno od ${baseName}`;
  } else {
    // Add counter suffix
    let counter = 2;
    do {
      name = `Odpojeno od ${baseName} ${counter}`;
      counter++;
    } while (existingNames.includes(name));
  }

  const slug = toSlug(name);
  const uuid = crypto.randomUUID().slice(0, 8);
  const newPersonId = `person-${uuid}--${slug}`;

  const newPerson: Person = {
    id: newPersonId,
    name,
    faceDescriptor: [],
    clusters: [],
    faceCount: 1,
    thumbnail: `faces/${newPersonId}/${imgId}.jpg`,
    hidden: shouldHide || sourcePerson.hidden,
    junk: sourcePerson.junk,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    category: sourcePerson.category || "person",
    isUserNamed: false,
  };

  peopleManifest.people.push(newPerson);
  return newPerson;
}

/**
 * Detaches faces from a person, creating new person entities for them.
 * Useful when a face cluster contains multiple distinct people.
 * Handles creating new person entries, moving face crops, and updating references.
 */
export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const { log, logContext } = locals;
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }

  const body = await request.json();
  const validation = validateUnmatchInput(body);

  if (!validation.valid) {
    return json({ success: false, error: validation.error }, { status: validation.status });
  }

  const { personId, imageIds, ignore } = validation.data;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const facesDir = path.resolve(process.cwd(), `static-${contentDir}`, "faces");

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
    id: "face-unmatch",
    label: "Odpojování obličejů...",
  });

  try {
    return await withManifestLock(dataDir, async function () {
      const peopleManifest = await loadPeopleManifest(dataDir, scriptLog);
      const imagesManifest = await loadImagesManifest(dataDir, scriptLog);
      const facesManifest = (await loadFacesManifest(dataDir, scriptLog)) || {};

      if (!peopleManifest || !imagesManifest) throw new Error("Manifests missing");

      const sourcePerson = peopleManifest.people.find((person) => person.id === personId);
      if (!sourcePerson) throw new Error("Source person not found");

      const transactionLog: Array<{ from: string; to: string }> = [];

      try {
        const processedNewPeople: Person[] = [];

        for (const imgId of imageIds) {
          const newPerson = createNewPerson(peopleManifest, sourcePerson, imgId, !!ignore);
          processedNewPeople.push(newPerson);

          const updated = updateImagePersonReference(
            imagesManifest,
            facesManifest,
            imgId,
            personId,
            newPerson.id,
          );

          if (updated) {
            // Fallback: If facesManifest didn't exist for this image, create it now
            if (!facesManifest[imgId]) {
              facesManifest[imgId] = {
                facesDetected: false,
                faces: [],
                peopleIds: [newPerson.id],
              };
            }

            // Move Face Crop logic inline with tracking
            const oldPath = path.resolve(facesDir, personId, `${imgId}.jpg`);
            const newDir = path.resolve(facesDir, newPerson.id);
            const newPath = path.resolve(newDir, `${imgId}.jpg`);

            await fsp.mkdir(newDir, { recursive: true });
            try {
              await fsp.rename(oldPath, newPath);
              transactionLog.push({ from: oldPath, to: newPath });
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
                throw e; // Throw only if real FS error, ignore missing files
              }
            }

            await addReassignmentConstraints(dataDir, [imgId], personId, newPerson.id, scriptLog);
          }
        }

        // Finalize source person with authoritative recalculation
        sourcePerson.faceCount = recalculateFaceCount(personId, imagesManifest);

        if (sourcePerson.faceCount <= 0) {
          peopleManifest.people = peopleManifest.people.filter((person) => person.id !== personId);
          await removeEmptyPersonFolder(facesDir, personId, scriptLog);
        } else {
          // Person remains, ensure valid thumbnail
          await refreshPersonThumbnail(sourcePerson, facesDir);
        }

        await savePeopleManifest(dataDir, peopleManifest, scriptLog);
        await saveImagesManifest(dataDir, imagesManifest, scriptLog);
        await saveFacesManifest(dataDir, facesManifest, scriptLog);

        // Force reload of in-memory manifest cache
        await reloadManifests();

        logContext.personId = personId;
        logContext.newPeopleCount = processedNewPeople.length;
        return json({
          success: true,
          count: imageIds.length,
          newPeople: processedNewPeople,
        });
      } catch (err) {
        // Rollback
        if (transactionLog.length > 0) {
          log.warn(
            { rollbackCount: transactionLog.length },
            "UNMATCH: Error occurred, rolling back file moves",
          );
          for (const logEntry of transactionLog.reverse()) {
            try {
              await fsp.rename(logEntry.to, logEntry.from);
            } catch (rollbackErr) {
              log.error(
                { err: rollbackErr, from: logEntry.to, to: logEntry.from },
                "UNMATCH: Rollback failed",
              );
            }
          }
        }
        throw err;
      }
    });
  } catch (err) {
    log.error({ err }, "UNMATCH: Error");
    return json({ success: false, error: (err as Error).message }, { status: 500 });
  } finally {
    await clearTaskStatus(dataDir);
  }
}
