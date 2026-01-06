import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { withManifestLock } from "$scripts/lib/manifests/lock";
import {
  loadClusteringConstraints,
  saveClusteringConstraints,
} from "$scripts/lib/manifests/repository";

export async function GET({ locals }: { locals: App.Locals }) {
  if (!dev) {
    throw error(403, "Constraints reading is restricted to DEV.");
  }

  const { log } = locals;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);

  try {
    const constraints = await loadClusteringConstraints(dataDir);
    return json({
      success: true,
      invalidDetections: constraints?.invalidDetections || [],
      disconnects: constraints?.disconnects || [],
      connects: constraints?.connects || [],
    });
  } catch (err) {
    log.error({ err }, "Failed to load constraints");
    throw error(500, "Failed to load constraints");
  }
}

export async function DELETE({ url, locals }: { url: URL; locals: App.Locals }) {
  if (!dev) {
    throw error(403, "Manifest modifications are restricted to DEV.");
  }

  const { log } = locals;
  const contentDir = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), "src/data", contentDir);
  const type = url.searchParams.get("type") || "invalid-detections";

  try {
    await withManifestLock(dataDir, async () => {
      const constraints = await loadClusteringConstraints(dataDir);
      if (constraints) {
        if (type === "invalid-detections") {
          constraints.invalidDetections = [];
        } else if (type === "disconnects") {
          constraints.disconnects = [];
        } else if (type === "connects") {
          constraints.connects = [];
        } else {
          throw error(400, "Invalid constraint type");
        }
        await saveClusteringConstraints(dataDir, constraints);
      }
    });

    log.info({ type }, "Cleared constraints from manifest");
    return json({ success: true, message: `${type} cleared.` });
  } catch (err) {
    log.error({ err, type }, "Failed to clear constraints");
    throw error(500, `Failed to clear ${type}`);
  }
}
