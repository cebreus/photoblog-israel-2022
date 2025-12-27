import { spawnSync as nodeSpawnSync } from "node:child_process";
import fsp from "node:fs/promises";

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
      // dot: options.dot ?? false // Bun.Glob has dot parameter in constructor or scan? Scan options.
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
