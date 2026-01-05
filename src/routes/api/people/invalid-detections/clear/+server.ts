import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadClusteringConstraints,
  saveClusteringConstraints,
} from "$scripts/lib/manifests/repository";

/**
 * Clears all invalid detections from clustering constraints.
 * This allows previously invalidated detections to be re-processed by face clustering.
 */
export async function DELETE({ locals }: { locals: App.Locals }) {
  const { log, logContext } = locals;
  if (!dev) {
    throw error(403, "Manifest modifications are not permitted on the production server.");
  }

  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

  try {
    return await withManifestLock(dataDir, async function () {
      const constraints = await loadClusteringConstraints(dataDir);

      if (
        !constraints ||
        !constraints.invalidDetections ||
        constraints.invalidDetections.length === 0
      ) {
        return json({ success: true, cleared: 0, message: "No invalid detections to clear" });
      }

      const count = constraints.invalidDetections.length;
      constraints.invalidDetections = [];

      await saveClusteringConstraints(dataDir, constraints);

      log.info({ count }, "Cleared invalid detections");
      logContext.clearedCount = count;
      return json({ success: true, cleared: count });
    });
  } catch (err) {
    log.error({ err }, "CLEAR-INVALID-DETECTIONS: Failure");
    return json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
