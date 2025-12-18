import type { ImageEntry, Manifest, PeopleManifest } from "$lib/types/manifest";
import { toSlug } from "$lib/utils/strings";
import { json } from "@sveltejs/kit";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";

export async function POST({ request }) {
  const { personId, imageId, imageIds } = await request.json();

  // Support both single imageId and array imageIds
  const idsToUnmatch = imageIds || (imageId ? [imageId] : []);

  if (!personId || idsToUnmatch.length === 0) {
    return json({ success: false, error: "Missing parameters" }, { status: 400 });
  }

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const peopleManifestPath = path.resolve(
    process.cwd(),
    `src/data/${contentDir}/people.manifest.json`,
  );
  const imagesManifestPath = path.resolve(
    process.cwd(),
    `src/data/${contentDir}/images.manifest.json`,
  );
  const facesDir = path.resolve(process.cwd(), `static/${contentDir}/faces`);

  try {
    // Load manifests
    const peopleManifest: PeopleManifest = JSON.parse(
      await fsp.readFile(peopleManifestPath, "utf-8"),
    );
    const imagesManifest: Manifest = JSON.parse(await fsp.readFile(imagesManifestPath, "utf-8"));

    // Find original person
    const sourcePerson = peopleManifest.people.find((p) => p.id === personId);
    if (!sourcePerson) {
      return json({ success: false, error: "Person not found" }, { status: 404 });
    }

    const processedNewPeople = [];
    const idSet = new Set(idsToUnmatch);

    for (const id of idsToUnmatch) {
      // Create NEW person
      const name = `Odpojeno z ${sourcePerson.name}`;
      const slug = toSlug(name);

      const uuid = crypto.randomUUID().slice(0, 8);
      const newPersonId = `person-${uuid}--${slug}`;

      const newPerson = {
        id: newPersonId,
        name,
        // Empty descriptor since we don't have the specific face vector here
        faceDescriptor: [],
        faceCount: 1,
        thumbnail: `faces/${newPersonId}/${id}.jpg`,
        ignored: false,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };

      // Add new person to manifest
      peopleManifest.people.push(newPerson);
      processedNewPeople.push(newPerson);

      // Update Image in Manifest
      let imageUpdated = false;
      for (const day of imagesManifest.photoDays) {
        for (const item of day.items) {
          if (item.type === "image" && item.id === id) {
            const img = item as ImageEntry;
            if (img.people && img.people.includes(personId)) {
              // Remove old person
              img.people = img.people.filter((pid) => pid !== personId);
              // Add new person
              img.people.push(newPersonId);
              imageUpdated = true;
            }
          }
        }
      }

      if (!imageUpdated) {
        console.warn(`[UNMATCH] Image ${id} or person link not found, skipping move`);
        continue;
      }

      // Move File
      const oldPath = path.resolve(facesDir, personId, `${id}.jpg`);
      const newDir = path.resolve(facesDir, newPersonId);
      const newPath = path.resolve(newDir, `${id}.jpg`);

      await fsp.mkdir(newDir, { recursive: true });

      // Check if file exists
      try {
        await fsp.rename(oldPath, newPath);
      } catch (e) {
        console.warn(`[UNMATCH] File move failed: ${oldPath} -> ${newPath}`);
      }
    }

    // Update counts
    sourcePerson.faceCount = Math.max(0, sourcePerson.faceCount - idsToUnmatch.length);

    // Check if we removed the thumbnail OR if we need to re-validate it
    if (sourcePerson.faceCount > 0) {
      const sourceDir = path.resolve(facesDir, personId);
      let needsNewThumbnail = false;

      // 1. Check if current thumbnail matches any of the removed image IDs
      if (
        !sourcePerson.thumbnail ||
        idsToUnmatch.some((id: string) => sourcePerson.thumbnail?.includes(id))
      ) {
        console.log(`[UNMATCH] Thumbnail matches one of removed images, invalidating...`);
        needsNewThumbnail = true;
      }

      // 2. Check if current thumbnail file actually exists (robustness)
      if (!needsNewThumbnail && sourcePerson.thumbnail) {
        try {
          const thumbPath = path.resolve(
            process.cwd(),
            `static/${contentDir}`,
            sourcePerson.thumbnail,
          );
          await fsp.access(thumbPath);
        } catch {
          console.log(
            `[UNMATCH] Current thumbnail file not found: ${sourcePerson.thumbnail}, invalidating...`,
          );
          needsNewThumbnail = true;
        }
      }

      if (needsNewThumbnail) {
        console.log(`[UNMATCH] Searching for new thumbnail for ${sourcePerson.name}...`);
        try {
          const files = await fsp.readdir(sourceDir);
          const validImages = files
            .filter(
              (f) => f.endsWith(".jpg") && !idSet.has(f.replace(".jpg", "")) && !f.startsWith("."),
            )
            .sort();

          if (validImages.length > 0) {
            sourcePerson.thumbnail = `faces/${personId}/${validImages[0]}`;
          } else {
            sourcePerson.thumbnail = "";
          }
        } catch (e) {
          sourcePerson.thumbnail = "";
        }
      }
    } else {
      sourcePerson.thumbnail = "";
    }

    // Save manifests
    await fsp.writeFile(peopleManifestPath, JSON.stringify(peopleManifest, null, 2));
    await fsp.writeFile(imagesManifestPath, JSON.stringify(imagesManifest, null, 2));

    // Save Disconnection Constraints
    const constraintsPath = path.resolve(
      process.cwd(),
      `src/data/${contentDir}/clustering-constraints.json`,
    );
    try {
      interface Constraints {
        disconnects: { imageId: string; personId: string }[];
      }
      let constraints: Constraints = { disconnects: [] };
      try {
        const data = await fsp.readFile(constraintsPath, "utf-8");
        constraints = JSON.parse(data);
      } catch (e) {}

      if (!constraints.disconnects) constraints.disconnects = [];

      for (const id of idsToUnmatch) {
        constraints.disconnects.push({ imageId: id, personId: personId });
      }

      await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
    } catch (e) {}

    return json({ success: true, count: idsToUnmatch.length });
  } catch (error) {
    console.error("[UNMATCH] Error:", error);
    return json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}
