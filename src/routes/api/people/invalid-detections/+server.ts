import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { config } from "$scripts/build.config";
import { loadClusteringConstraints } from "$scripts/lib/manifests/repository";

export async function GET({ locals }: { locals: App.Locals }) {
  if (!dev) {
    throw error(403, "Invalid detections reading is restricted to DEV.");
  }

  const { log } = locals;

  try {
    const dataDir = path.resolve(process.cwd(), config.paths.dataRoot);
    const constraints = await loadClusteringConstraints(dataDir);

    return json({
      success: true,
      invalidDetections: constraints?.invalidDetections || [],
    });
  } catch (err) {
    log.error({ err }, "Failed to load invalid detections");
    throw error(500, "Failed to load invalid detections");
  }
}
