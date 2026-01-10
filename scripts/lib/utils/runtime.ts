import { spawnSync as nodeSpawnSync } from "node:child_process";
import fsp from "node:fs/promises";
import { logIoDebug } from "./io-logger-bridge";

/**
 * Universal runtime utilities to handle Bun vs Node.js differences centrally.
 * This ensures that build scripts can be run by Bun (CLI) and Node.js (Vite/SvelteKit).
 */

// Safely detect Bun
export const IS_BUN =
  typeof globalThis !== "undefined" && typeof (globalThis as any).Bun !== "undefined";

/**
 * Check if a file exists (multi-runtime).
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file exists (multi-runtime).
 */
export const exists = fileExists;

/**
 * Write file securely (multi-runtime).
 */
export async function writeFile(
  filePath: string,
  data: string | Uint8Array | ArrayBuffer | Buffer,
): Promise<void> {
  if (IS_BUN) {
    await Bun.write(filePath, data);
  } else {
    const buffer =
      data instanceof ArrayBuffer
        ? Buffer.from(data)
        : data instanceof Uint8Array
          ? Buffer.from(data)
          : data;
    await fsp.writeFile(filePath, buffer as any);
  }
  logIoDebug(
    { filePath, size: data instanceof ArrayBuffer ? data.byteLength : data.length },
    "IO: Write file",
  );
}

/**
 * Scan for files using glob (multi-runtime).
 */
export async function scanGlob(
  pattern: string,
  options: { cwd: string; absolute?: boolean; dot?: boolean },
): Promise<string[]> {
  if (IS_BUN) {
    const glob = new Bun.Glob(pattern);
    const results: string[] = [];
    for await (const file of glob.scan({
      cwd: options.cwd,
      absolute: options.absolute ?? true,
      // TODO: Verify dotfile handling coverage in Bun.Glob scan options
    })) {
      results.push(file);
    }
    return results;
  } else {
    const fg = (await import("fast-glob")).default;
    return await fg(pattern, {
      cwd: options.cwd,
      absolute: options.absolute ?? true,
      dot: options.dot ?? false,
    });
  }
}

/**
 * Run a command synchronously (multi-runtime).
 */
export function spawnSync(cmd: string, args: string[], options: any = {}) {
  logIoDebug({ cmd: `${cmd} ${args.join(" ")}` }, "IO: Spawn sync");
  if (IS_BUN) {
    return Bun.spawnSync([cmd, ...args], options);
  } else {
    return nodeSpawnSync(cmd, args, options);
  }
}

/**
 * Read file as text (multi-runtime).
 */
export async function readFileText(filePath: string): Promise<string> {
  if (IS_BUN) {
    return await Bun.file(filePath).text();
  } else {
    return await fsp.readFile(filePath, "utf-8");
  }
}

/**
 * Read file as json (multi-runtime).
 */
export async function readFileJson<T>(filePath: string): Promise<T> {
  if (IS_BUN) {
    return await Bun.file(filePath).json();
  } else {
    const content = await fsp.readFile(filePath, "utf-8");
    return JSON.parse(content);
  }
}
/**
 * Run a command asynchronously (multi-runtime).
 * Returns an object with an `exited` promise that resolves to the exit code.
 */
export async function spawn(
  cmd: string,
  args: string[],
  options: any = {},
): Promise<{ exited: Promise<number>; stdout?: any; stderr?: any }> {
  logIoDebug({ cmd: `${cmd} ${args.join(" ")}` }, "IO: Spawn async");
  if (IS_BUN) {
    const proc = Bun.spawn([cmd, ...args], options);
    return {
      exited: proc.exited,
      stdout: proc.stdout,
      stderr: proc.stderr,
    };
  } else {
    const { spawn: nodeSpawn } = await import("node:child_process");
    const proc = nodeSpawn(cmd, args, {
      ...options,
      stdio: options.stdout === "inherit" ? "inherit" : options.stdio || "pipe",
    });

    const exited = new Promise<number>((resolve) => {
      proc.on("close", (code) => resolve(code ?? 0));
      proc.on("error", () => resolve(1));
    });

    return {
      exited,
      stdout: proc.stdout ? (await import("node:stream")).Readable.toWeb(proc.stdout) : undefined,
      stderr: proc.stderr ? (await import("node:stream")).Readable.toWeb(proc.stderr) : undefined,
    };
  }
}

/**
 * Remove file or directory (multi-runtime).
 */
export async function rm(filePath: string, options: { recursive?: boolean } = {}): Promise<void> {
  logIoDebug({ filePath, ...options }, "IO: Remove path");
  await fsp.rm(filePath, { recursive: options.recursive ?? true, force: true });
}
