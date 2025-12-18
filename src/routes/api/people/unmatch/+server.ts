import type { ImageEntry, Manifest, PeopleManifest } from "$lib/types/manifest";
import { toSlug } from "$lib/utils/strings";
import { json } from "@sveltejs/kit";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";

export async function POST({ request }) {
  const { personId, imageId } = await request.json();

  if (!personId || !imageId) {
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
      thumbnail: `faces/${newPersonId}/${imageId}.jpg`,
      ignored: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    // Add new person to manifest
    peopleManifest.people.push(newPerson);

    // Update Image in Manifest
    let imageUpdated = false;
    for (const day of imagesManifest.photoDays) {
      for (const item of day.items) {
        if (item.type === "image" && item.id === imageId) {
          const img = item as ImageEntry;
          if (img.people && img.people.includes(personId)) {
            // Remove old person
            img.people = img.people.filter((id) => id !== personId);
            // Add new person
            img.people.push(newPersonId);
            imageUpdated = true;
          }
        }
      }
    }

    if (!imageUpdated) {
      return json({ success: false, error: "Image/Person link not found" }, { status: 404 });
    }

    // Move File
    const oldPath = path.resolve(facesDir, personId, `${imageId}.jpg`);
    const newDir = path.resolve(facesDir, newPersonId);
    const newPath = path.resolve(newDir, `${imageId}.jpg`);

    await fsp.mkdir(newDir, { recursive: true });

    // Check if file exists
    try {
      await fsp.rename(oldPath, newPath);
    } catch (e) {
      // If file missing, we proceed (manifest update is key).
      // But likely we should log.
      console.warn(`[UNMATCH] File move failed: ${oldPath} -> ${newPath}`);
    }

    // Update counts
    sourcePerson.faceCount = Math.max(0, sourcePerson.faceCount - 1);

    // Check if we removed the thumbnail
    if (sourcePerson.thumbnail && sourcePerson.thumbnail.includes(imageId)) {
      console.log(`[UNMATCH] Removed thumbnail for ${sourcePerson.name}, looking for replacement...`);
      // List remaining files in the source person's directory to pick a new thumbnail
      const sourceDir = path.resolve(facesDir, personId);
      try {
        const files = await fsp.readdir(sourceDir);
        // Filter for jpg files and exclude the one we just moved (though it should be gone)
        const validImages = files.filter(
          (f) => f.endsWith(".jpg") && !f.includes(imageId) && !f.startsWith("."),
        );

        if (validImages.length > 0) {
          // Pick the first one
          sourcePerson.thumbnail = `faces/${personId}/${validImages[0]}`;
          console.log(`[UNMATCH] New thumbnail: ${sourcePerson.thumbnail}`);
        } else {
          // No images left
          sourcePerson.thumbnail = "";
          console.log(`[UNMATCH] No images left for thumbnail`);
        }
      } catch (e) {
        // Directory might not exist or other error
        sourcePerson.thumbnail = "";
      }
    }

    // Save manifests
    await fsp.writeFile(peopleManifestPath, JSON.stringify(peopleManifest, null, 2));
    await fsp.writeFile(imagesManifestPath, JSON.stringify(imagesManifest, null, 2));

    // Save Disconnection Constraint (for future AI clustering)
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
      } catch (e) {
        // File doesn't exist or is invalid, start clean
      }

      if (!constraints.disconnects) constraints.disconnects = [];

      // Add constraint: This imageId CANNOT belong to sourcePersonId
      constraints.disconnects.push({ imageId, personId: personId });

      await fsp.writeFile(constraintsPath, JSON.stringify(constraints, null, 2));
    } catch (e) {
      console.error("Failed to save clustering constraints:", e);
      // Non-critical, but logging it.
    }

    return json({ success: true, newPerson });
  } catch (error) {
    console.error("[UNMATCH] Error:", error);
    return json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}
