import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { saveTaskStatus } from "$lib/server/task-status";
import { config } from "$scripts/build.config";
import { spawn } from "$scripts/lib/utils/runtime";

export async function POST({ locals }: { locals: App.Locals }) {
  if (!dev) {
    throw error(403, "Clustering can only be triggered in DEV mode.");
  }

  const { log } = locals;
  const gallery = process.env.CONTENT_DIR || "egypt-2025";
  const dataDir = path.resolve(process.cwd(), config.paths.dataRoot);

  log.info({ gallery }, "Triggering face clustering re-analysis from UI");

  try {
    // Save task status before spawning
    await saveTaskStatus(dataDir, {
      id: "clustering",
      label: "Analýza obličejů...",
    });

    // Run the clustering script in background
    const proc = await spawn(
      "bun",
      ["scripts/face-clustering.ts", `--gallery=${gallery}`, "--verbose"],
      {
        stdout: "inherit",
        stderr: "inherit",
      },
    );

    // Check if it starts successfully
    const result = (await Promise.race([
      proc.exited.then((code) => ({ type: "exited", code })),
      new Promise((resolve) => setTimeout(() => resolve({ type: "running" }), 1000)),
    ])) as { type: "exited"; code: number } | { type: "running" };

    if (result.type === "exited" && result.code !== 0) {
      throw new Error(`Clustering script failed immediately with code ${result.code}`);
    }

    return json({
      success: true,
      message:
        result.type === "running"
          ? "Clustering started in background."
          : "Clustering finished quickly.",
    });
  } catch (err) {
    log.error({ err }, "Failed to trigger clustering");
    throw error(500, "Failed to run clustering script.");
  }
}
