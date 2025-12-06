import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export function tmpDir(prefix: string): string {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  return p;
}

export async function runCli(
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const proc = spawn("bun", ["scripts/generate-images.ts", ...args], {
        cwd: opts?.cwd ?? path.resolve(__dirname, "../../.."),
        env: {
          ...process.env,
          SHARP_NUM_THREADS: "1",
          TZ: "UTC",
          ...(opts?.env || {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timeout = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch (_) {}
        reject(new Error("CLI timeout"));
      }, opts?.timeoutMs ?? 60000);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (d) => (stdout += String(d)));
      proc.stderr.on("data", (d) => (stderr += String(d)));
      proc.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ code: code ?? -1, stdout, stderr });
      });
      proc.on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    },
  );
}
