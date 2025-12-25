import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireManifestLock, withManifestLock } from "../../../scripts/lib/manifests/lock";

describe("Manifest Lock", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fsp.mkdtemp(path.join(os.tmpdir(), "photoblog-lock-test-"));
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  it("should acquire and release lock", async () => {
    const release = await acquireManifestLock(testDir);
    const lockFile = path.join(testDir, ".manifest.lock");

    await expect(fsp.access(lockFile)).resolves.toBeUndefined();

    await release();

    await expect(fsp.access(lockFile)).rejects.toThrow();
  });

  it("should wait for lock to release", async () => {
    let secondAcquired = false;
    const releaseFirst = await acquireManifestLock(testDir);

    const secondPromise = acquireManifestLock(testDir).then((rel) => {
      secondAcquired = true;
      return rel();
    });

    // Wait a bit, second should still be waiting
    await new Promise((r) => setTimeout(r, 150));
    expect(secondAcquired).toBe(false);

    await releaseFirst();

    await secondPromise;
    expect(secondAcquired).toBe(true);
  });

  it("should throw error on timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Take the lock
    const release = await acquireManifestLock(testDir);

    // Try to take it again - it should wait
    const timeoutPromise = acquireManifestLock(testDir);

    // Advance time by 30s
    await vi.advanceTimersByTimeAsync(30005);

    await expect(timeoutPromise).rejects.toThrow("Manifest lock timeout");

    await release();
    vi.useRealTimers();
  });

  it("should handle parallel withManifestLock calls", async () => {
    let counter = 0;
    const op = async () => {
      const current = counter;
      await new Promise((r) => setTimeout(r, 50));
      counter = current + 1;
      return counter;
    };

    const results = await Promise.all([
      withManifestLock(testDir, op),
      withManifestLock(testDir, op),
      withManifestLock(testDir, op),
    ]);

    expect(counter).toBe(3);
    expect(results.sort()).toEqual([1, 2, 3]);
  });

  it("should release lock even if operation fails", async () => {
    await expect(
      withManifestLock(testDir, async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    const lockFile = path.join(testDir, ".manifest.lock");
    await expect(fsp.access(lockFile)).rejects.toThrow();

    // Should be able to acquire again
    const release = await acquireManifestLock(testDir);
    await release();
  });
});
