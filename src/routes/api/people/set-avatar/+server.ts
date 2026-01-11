import { dev } from "$app/environment";
import { getContentDir } from "$lib/config";
import { reloadManifests } from "$lib/utils/manifest-loader";
import { withManifestLock } from "$scripts/manifests/lock";
import { loadPeopleManifest, savePeopleManifest } from "$scripts/manifests/repository";
import { error, json } from "@sveltejs/kit";
import path from "node:path";

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  const { log, logContext } = locals;
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }

  const { personId, avatarPath } = await request.json();

  if (!personId || !avatarPath) {
    return json({ success: false, error: "Missing personId or avatarPath" }, { status: 400 });
  }

  const contentDir = getContentDir();
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

  log.info({ personId, avatarPath }, "Setting avatar");

  try {
    return await withManifestLock(dataDir, async function () {
      const peopleManifest = await loadPeopleManifest(dataDir);
      if (!peopleManifest) throw new Error("Manifest missing");

      const person = peopleManifest.people.find((p) => p.id === personId);
      if (!person) {
        log.error({ personId }, "SET-AVATAR: Person not found");
        throw new Error("Person not found");
      }

      person.thumbnail = avatarPath;

      await savePeopleManifest(dataDir, peopleManifest);

      await reloadManifests();

      logContext.personId = personId;
      logContext.avatarPath = avatarPath;
      return json({
        success: true,
        avatarPath,
        updatedPerson: { id: personId, thumbnail: avatarPath },
      });
    });
  } catch (err) {
    log.error({ err }, "SET-AVATAR: Failure");
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
