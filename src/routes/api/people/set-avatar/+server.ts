import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { getContentDir } from "$lib/config";
import { createLogger } from "$lib/logger";
import { reloadManifests } from "$lib/utils/images";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import { loadPeopleManifest, savePeopleManifest } from "$scripts/lib/manifests/repository";

const logger = createLogger("api:people:set-avatar");

export async function POST({ request }: { request: Request }) {
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }

  const { personId, avatar } = await request.json();

  if (!personId || !avatar) {
    return json({ success: false, error: "Missing personId or avatar" }, { status: 400 });
  }

  const contentDir = getContentDir();
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

  logger.info(`Setting avatar for ${personId} to ${avatar}`);

  try {
    return await withManifestLock(dataDir, async function () {
      const peopleManifest = await loadPeopleManifest(dataDir);
      if (!peopleManifest) throw new Error("Manifest missing");

      const person = peopleManifest.people.find((p) => p.id === personId);
      if (!person) throw new Error("Person not found");

      person.thumbnail = avatar;

      await savePeopleManifest(dataDir, peopleManifest);

      await reloadManifests();

      return json({ success: true, avatar });
    });
  } catch (err) {
    logger.error("[SET-AVATAR] Failure:", err);
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
