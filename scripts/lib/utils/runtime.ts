/**
 * @fileoverview Cross-runtime filesystem and process utilities.
 *
 * @description
 * Provides Bun/Node abstractions for file I/O, globbing and process spawning.
 */

import { spawnSync as nodeSpawnSync } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { isHeic, isJpeg, isPng } from "../../../shared/types/images";
import { toSlug } from "../../../shared/utils/strings";
import { logIoDebug } from "./io-logger-bridge";
import { measure, measureSync } from "./performance";

// Safely detect Bun
export const IS_BUN =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as unknown as { Bun: unknown }).Bun !== "undefined";

/**
 * Check if a file exists (multi-runtime).
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return measure(`io:exists:${filePath}`, async () => {
    try {
      await fsp.access(filePath);
      return true;
    } catch (_e: unknown) {
      return false;
    }
  });
}

/**
 * Check if a directory exists (multi-runtime).
 */
export async function directoryExists(directoryPath: string): Promise<boolean> {
  return measure(`io:exists:${directoryPath}`, async () => {
    try {
      const stats = await fsp.stat(directoryPath);
      return stats.isDirectory();
    } catch (_e: unknown) {
      return false;
    }
  });
}

/**
 * Write file securely (multi-runtime).
 */
export async function writeFile(
  filePath: string,
  data: string | Uint8Array | ArrayBuffer | Buffer,
  options: { flag?: string; encoding?: BufferEncoding } = {},
): Promise<void> {
  await measure(`io:write:${filePath}`, async () => {
    if (IS_BUN && !options.flag) {
      await Bun.write(filePath, data);
    } else {
      let buffer: string | Uint8Array | Buffer;
      if (data instanceof ArrayBuffer) {
        buffer = Buffer.from(data);
      } else {
        buffer = data as string | Uint8Array | Buffer;
      }
      await fsp.writeFile(filePath, buffer, options);
    }
  });
  let size: number;
  if (data instanceof ArrayBuffer) {
    size = data.byteLength;
  } else {
    size = (data as { length: number }).length;
  }
  logIoDebug(
    {
      filePath,
      size,
      ...options,
    },
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
  return measure(`io:scan:${pattern}`, async () => {
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
  });
}

/**
 * Run a command synchronously (multi-runtime).
 */
export function spawnSync(cmd: string, args: string[], options: Record<string, any> = {}) {
  logIoDebug({ cmd: `${cmd} ${args.join(" ")}` }, "IO: Spawn sync");
  return measureSync(`io:spawnSync:${cmd}`, () => {
    if (IS_BUN) {
      return Bun.spawnSync([cmd, ...args], options);
    } else {
      return nodeSpawnSync(cmd, args, options);
    }
  });
}

/**
 * Read file as text (multi-runtime).
 */
export async function readFileText(filePath: string): Promise<string> {
  return measure(`io:readText:${filePath}`, async () => {
    if (IS_BUN) {
      return await Bun.file(filePath).text();
    } else {
      return await fsp.readFile(filePath, "utf-8");
    }
  });
}

/**
 * Read file as buffer (multi-runtime).
 */
export async function readFileBuffer(filePath: string): Promise<Buffer> {
  return measure(`io:readBuffer:${filePath}`, async () => {
    if (IS_BUN) {
      const arrayBuffer = await Bun.file(filePath).arrayBuffer();
      return Buffer.from(arrayBuffer);
    } else {
      return await fsp.readFile(filePath);
    }
  });
}

/**
 * Read file as json (multi-runtime).
 */
export async function readFileJson<T>(filePath: string): Promise<T> {
  return measure(`io:readJson:${filePath}`, async () => {
    if (IS_BUN) {
      return await Bun.file(filePath).json();
    } else {
      const content = await fsp.readFile(filePath, "utf-8");
      return JSON.parse(content);
    }
  });
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
      exited: measure(`io:spawn:${cmd}`, () => proc.exited),
      stdout: proc.stdout,
      stderr: proc.stderr,
    };
  } else {
    const { spawn: nodeSpawn } = await import("node:child_process");
    let stdio = options.stdio || "pipe";
    if (options.stdout === "inherit") {
      stdio = "inherit";
    }

    const proc = nodeSpawn(cmd, args, {
      ...options,
      stdio,
    });

    const exited = new Promise<number>((resolve) => {
      proc.on("close", (code) => resolve(code ?? 0));
      proc.on("error", () => resolve(1));
    });

    let stdout: any;
    if (proc.stdout) {
      stdout = (await import("node:stream")).Readable.toWeb(proc.stdout);
    }

    let stderr: any;
    if (proc.stderr) {
      stderr = (await import("node:stream")).Readable.toWeb(proc.stderr);
    }

    return {
      exited: measure(`io:spawn:${cmd}`, () => exited),
      stdout,
      stderr,
    };
  }
}

/**
 * Remove file or directory (multi-runtime).
 */
export async function rm(filePath: string, options: { recursive?: boolean } = {}): Promise<void> {
  logIoDebug({ filePath, ...options }, "IO: Remove path");
  await measure(`io:rm:${filePath}`, async () => {
    await fsp.rm(filePath, { recursive: options.recursive ?? true, force: true });
  });
}

/**
 * Make directory (multi-runtime).
 */
export async function mkdir(
  dirPath: string,
  options: { recursive?: boolean } = {},
): Promise<string | undefined> {
  logIoDebug({ dirPath, ...options }, "IO: Mkdir");
  return measure(`io:mkdir:${dirPath}`, async () => {
    return await fsp.mkdir(dirPath, options);
  });
}

/**
 * Rename file (multi-runtime).
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
  logIoDebug({ oldPath, newPath }, "IO: Rename");
  await measure(`io:rename:${oldPath}->${newPath}`, async () => {
    await fsp.rename(oldPath, newPath);
  });
}

/**
 * Get file stats (multi-runtime).
 */
export async function stat(filePath: string): Promise<import("node:fs").Stats> {
  // logIoDebug({ filePath }, "IO: Stat"); // Too verbose?
  return measure(`io:stat:${filePath}`, async () => {
    return await fsp.stat(filePath);
  });
}

/**
 * Unlink (delete) file (multi-runtime).
 */
export async function unlink(filePath: string): Promise<void> {
  logIoDebug({ filePath }, "IO: Unlink");
  await measure(`io:unlink:${filePath}`, async () => {
    await fsp.unlink(filePath);
  });
}

/**
 * Read directory (multi-runtime).
 */
export async function readdir(dirPath: string, options?: any): Promise<any> {
  logIoDebug({ dirPath, ...options }, "IO: Readdir");
  return measure(`io:readdir:${dirPath}`, async () => {
    return await fsp.readdir(dirPath, options);
  });
}

/**
 * Copy file (multi-runtime).
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  logIoDebug({ src, dest }, "IO: CopyFile");
  await measure(`io:copy:${src}->${dest}`, async () => {
    await fsp.copyFile(src, dest);
  });
}

/**
 * Recursive copy (multi-runtime).
 */
export async function cp(
  src: string,
  dest: string,
  options: { recursive?: boolean; force?: boolean } = {},
): Promise<void> {
  logIoDebug({ src, dest, ...options }, "IO: Cp");
  await measure(`io:cp:${src}->${dest}`, async () => {
    await fsp.cp(src, dest, options);
  });
}

/**
 * Create temporary directory (multi-runtime).
 */
export async function mkdtemp(prefix: string): Promise<string> {
  logIoDebug({ prefix }, "IO: Mkdtemp");
  return measure(`io:mkdtemp:${prefix}`, async () => {
    return await fsp.mkdtemp(prefix);
  });
}

/**
 * Open file handle (multi-runtime).
 */
export async function open(filePath: string, flags: string): Promise<any> {
  logIoDebug({ filePath, flags }, "IO: Open");
  return measure(`io:open:${filePath}`, async () => {
    return await fsp.open(filePath, flags);
  });
}
/**
 * Get the file basename without its extension.
 */
export function basenameNoExt(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Safely delete a file if the path is provided, ignoring errors.
 */
export async function safeUnlink(filePath: string | null | undefined): Promise<void> {
  if (filePath) {
    await unlink(filePath).catch(() => {});
  }
}

/**
 * Safely delete a file or directory, ignoring errors.
 */
export async function safeRm(
  filePath: string | null | undefined,
  options: { recursive?: boolean } = {},
): Promise<void> {
  if (filePath) {
    await rm(filePath, options).catch(() => {});
  }
}

/**
 * Path-aware extension checks (requires node:path).
 * These are script-only utilities.
 */
export function isHeicPath(p: string): boolean {
  return isHeic(path.extname(p));
}
export function isJpegPath(p: string): boolean {
  return isJpeg(path.extname(p));
}
export function isPngPath(p: string): boolean {
  return isPng(path.extname(p));
}

/**
 * Validates and canonicalizes a given path, ensuring it stays within a specified safe root directory.
 * Prevents path traversal vulnerabilities.
 * @param unsafePath The path string to validate.
 * @param safeRoot The absolute path to the root directory that `unsafePath` must be contained within.
 * @returns The resolved, canonical absolute path if it is safe.
 * @throws An error if the path attempts to traverse outside the safe root.
 */
export function validatePathInsideRoot(unsafePath: string, safeRoot: string): string {
  const resolvedPath = path.resolve(safeRoot, unsafePath);

  // Ensure the resolved path starts with the safeRoot followed by a path separator,
  // or is the safeRoot itself (if unsafePath was just "").
  // This handles cases like "/safe/root/../evil" resolving to "/safe/evil".
  if (!resolvedPath.startsWith(safeRoot + path.sep) && resolvedPath !== safeRoot) {
    throw new Error(
      `Path traversal attempt detected: "${unsafePath}" resolves outside of the safe directory "${safeRoot}".`,
    );
  }
  return resolvedPath;
}

/**
 * Sanitizes a filename to remove any path separators or potentially dangerous characters,
 * ensuring it can only refer to a file within a single directory.
 * @param filename The filename string to sanitize.
 * @returns A sanitized filename.
 */
export function toSafeFilename(filename: string): string {
  // Remove any directory separators
  const safe = filename.replace(/[/\\]/g, "");
  // Remove common unsafe characters (e.g., those used in shell commands or regex)
  return toSlug(safe); // Assuming toSlug handles other unsafe chars well
}
