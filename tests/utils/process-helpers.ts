import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function tmpDir(prefix: string): string {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  return p;
}

export async function runCli(
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
) {
  // This is the old implementation that spawns a child process.
  // We will deprecate this in favor of runGenerator for unit tests.
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
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

    console.log(`Executing command: bun scripts/generate-images.ts ${args.join(" ")}`);

    const timeout = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch (_) {}
      reject(new Error("CLI timeout"));
    }, opts?.timeoutMs ?? 60000);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += String(d);
      console.log(`STDOUT: ${String(d)}`);
    });
    proc.stderr.on("data", (d) => {
      stderr += String(d);
      console.error(`STDERR: ${String(d)}`);
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      console.log(`Command exited with code: ${code}`);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    proc.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

// New helper to directly call the main logic for faster unit tests
export async function runGenerator(
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  const originalArgv = process.argv;
  const originalCwd = process.cwd();
  const originalEnv = process.env;

  try {
    process.argv = [
      "bun",
      "scripts/generate-images.ts",
      ...args.filter((arg) => !arg.startsWith("--blur")), // Filter out blur args if any, as executeMain does not support it directly
    ];
    process.cwd = () => opts?.cwd ?? originalCwd;
    process.env = {
      ...originalEnv,
      SHARP_NUM_THREADS: "1", // Ensure Sharp uses a single thread for consistency
      TZ: "UTC", // Set timezone for consistent date handling
      ...(opts?.env || {}),
    };

    let stdout = "";
    let stderr = "";

    // Mock console.log and console.error to capture output
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = (message?: any, ...optionalParams: any[]) => {
      stdout += message + "\n";
    };
    console.error = (message?: any, ...optionalParams: any[]) => {
      stderr += message + "\n";
    };

    // Replace process.exit to capture exit code without terminating the test runner
    let exitCode = 0;
    const originalProcessExit = process.exit;
    process.exit = (code: number = 0) => {
      exitCode = code;
      throw new Error(`Process exited with code ${code}`);
    };

    try {
      const { executeMain, resetCliState } = await import("../../scripts/generate-images");
      resetCliState(); // Force re-parsing of ARGS based on new process.argv
      await executeMain();
    } catch (e: any) {
      if (!e.message.startsWith("Process exited with code")) {
        // Only re-throw if it's not our controlled exit
        stderr += e.stack || e.message;
        exitCode = 1; // Mark as error if unexpected exception
      }
    } finally {
      // Restore original console and process.exit
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      process.exit = originalProcessExit;
    }

    return { code: exitCode, stdout, stderr };
  } finally {
    process.argv = originalArgv;
    process.cwd = () => originalCwd;
    process.env = originalEnv;
  }
}
