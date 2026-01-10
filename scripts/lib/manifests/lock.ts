import path from "node:path";
import { mkdir, readFileText, safeUnlink, writeFile } from "$scripts/utils/runtime";

const LOCK_TIMEOUT_MS = 30000;
const LOCK_RETRY_INTERVAL_MS = 100;
const LOCK_FILE_NAME = ".manifest.lock";

function createLockFilePath(dataDirectory: string) {
  return path.join(dataDirectory, LOCK_FILE_NAME);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(function resolveAfterDelay(resolve) {
    setTimeout(resolve, milliseconds);
  });
}

function hasTimedOut(startTime: number): boolean {
  return Date.now() - startTime >= LOCK_TIMEOUT_MS;
}

async function tryCreateLockFile(lockPath: string): Promise<boolean> {
  try {
    await writeFile(lockPath, String(process.pid), { flag: "wx" });
    return true;
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "EEXIST") {
      return false;
    }
    throw e;
  }
}

async function isProcessRunning(pid: string): Promise<boolean> {
  try {
    // signal 0 doesn't kill but checks if process exists
    process.kill(Number.parseInt(pid, 10), 0);
    return true;
  } catch {
    return false;
  }
}

async function checkAndRemoveStaleLock(lockPath: string): Promise<void> {
  try {
    const pid = await readFileText(lockPath);
    const running = await isProcessRunning(pid);
    if (!running) {
      await safeUnlink(lockPath);
    }
  } catch {
    // Ignore errors reading/checking stale lock
  }
}

async function removeLockFile(lockPath: string): Promise<void> {
  await safeUnlink(lockPath);
}

export async function acquireManifestLock(dataDirectory: string): Promise<() => Promise<void>> {
  await mkdir(dataDirectory, { recursive: true });
  const lockPath = createLockFilePath(dataDirectory);
  const startTime = Date.now();

  while (!hasTimedOut(startTime)) {
    const acquired = await tryCreateLockFile(lockPath);

    if (acquired) {
      return function releaseManifestLock() {
        return removeLockFile(lockPath);
      };
    }

    // Before waiting, check if the existing lock is stale
    await checkAndRemoveStaleLock(lockPath);

    await wait(LOCK_RETRY_INTERVAL_MS);
  }

  throw new Error("Manifest lock timeout - another script may be running");
}

export async function withManifestLock<T>(
  dataDirectory: string,
  operation: () => Promise<T>,
): Promise<T> {
  const releaseLock = await acquireManifestLock(dataDirectory);
  try {
    return await operation();
  } finally {
    await releaseLock();
  }
}
