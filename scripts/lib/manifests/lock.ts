import fsp from "node:fs/promises";
import path from "node:path";

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
    await fsp.writeFile(lockPath, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

async function removeLockFile(lockPath: string): Promise<void> {
  await fsp.unlink(lockPath).catch(function ignoreRemovalError() {});
}

export async function acquireManifestLock(dataDirectory: string): Promise<() => Promise<void>> {
  const lockPath = createLockFilePath(dataDirectory);
  const startTime = Date.now();

  while (!hasTimedOut(startTime)) {
    const acquired = await tryCreateLockFile(lockPath);

    if (acquired) {
      return function releaseManifestLock() {
        return removeLockFile(lockPath);
      };
    }

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
