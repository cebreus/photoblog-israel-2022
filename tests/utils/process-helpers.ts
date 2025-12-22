import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger } from "../../scripts/lib/logger";

const logger = createLogger("test-helpers");

export function tmpDir(prefix: string): string {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  return p;
}

export async function runCli(
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
) {
  return runScript("scripts/generate-images.ts", args, opts);
}

export async function runScript(
  scriptPath: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const proc = spawn("bun", [scriptPath, ...args], {
      cwd: opts?.cwd ?? path.resolve(__dirname, "../.."),
      env: {
        ...process.env,
        SHARP_NUM_THREADS: "1",
        TZ: "UTC",
        ...(opts?.env || {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    logger.verbose(`Executing command: bun ${scriptPath} ${args.join(" ")}`);

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
      logger.verbose(`STDOUT: ${String(d)}`);
    });
    proc.stderr.on("data", (d) => {
      stderr += String(d);
      logger.verbose(`STDERR: ${String(d)}`);
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      logger.verbose(`Command exited with code: ${code}`);
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
      ...args.filter((arg) => !arg.startsWith("--blur")),
    ];
    process.cwd = () => opts?.cwd ?? originalCwd;
    process.env = {
      ...originalEnv,
      SHARP_NUM_THREADS: "1",
      TZ: "UTC",
      ...(opts?.env || {}),
    };

    let stdout = "";
    let stderr = "";

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    const originalStdoutWrite = process.stdout.write;
    const originalStderrWrite = process.stderr.write;

    console.log = (message?: any, ...args: any[]) => {
      stdout += `${message}${args.length > 0 ? ` ${args.join(" ")}` : ""}\n`;
    };
    console.error = (message?: any, ...args: any[]) => {
      stderr += `${message}${args.length > 0 ? ` ${args.join(" ")}` : ""}\n`;
    };

    // Mock internal write methods
    (process.stdout as any).write = (chunk: string | Uint8Array) => {
      const str = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      stdout += str;
      return true;
    };
    (process.stderr as any).write = (chunk: string | Uint8Array) => {
      const str = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      stderr += str;
      return true;
    };

    // Replace process.exit to capture exit code without terminating the test runner
    let exitCode = 0;
    const originalProcessExit = process.exit;
    (process as any).exit = (code: number = 0) => {
      exitCode = code;
      throw new Error(`Process exited with code ${code}`);
    };

    try {
      const { executeMain, resetCliState } = await import("../../scripts/generate-images");
      resetCliState(); // Force re-parsing of ARGS based on new process.argv
      await executeMain();
    } catch (e: any) {
      if (!e.message?.startsWith("Process exited with code")) {
        // Only re-throw if it's not our controlled exit
        stderr += `\nUNEXPECTED ERROR: ${e.stack || e.message}\n`;
        exitCode = 1; // Mark as error if unexpected exception
      }
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;

      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;

      process.exit = originalProcessExit;
    }

    return { code: exitCode, stdout, stderr };
  } finally {
    process.argv = originalArgv;
    process.cwd = () => originalCwd;
    process.env = originalEnv;
  }
}
