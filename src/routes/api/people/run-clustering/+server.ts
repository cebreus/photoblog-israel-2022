import crypto from "node:crypto";
import path from "node:path";
import { error, json } from "@sveltejs/kit";
import { dev } from "$app/environment";
import { saveTaskStatus } from "$lib/server/task-status";
import { config } from "$config";
import { spawn } from "$scripts/utils/runtime";

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

    // Extract Trace ID from logger bindings if available, or generate a new one
    const traceId =
      // biome-ignore lint/suspicious/noExplicitAny: accessing internal pino bindings
      (log as any).bindings?.()?.requestId ||
      // biome-ignore lint/suspicious/noExplicitAny: accessing potentially untyped locals prop
      (locals as any).requestId ||
      crypto.randomUUID();

    // Run the clustering script in background
    const proc = await spawn(
      "bun",
      ["scripts/face-clustering.ts", `--gallery=${gallery}`, "--verbose"],
      {
        stdout: "inherit",
        stderr: "inherit",
        env: {
          ...process.env,
          TRACE_ID: traceId,
          FORCE_COLOR: "1", // Ensure colored output is captured if possible
        },
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
