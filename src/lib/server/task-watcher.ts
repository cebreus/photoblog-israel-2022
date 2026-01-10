import { mkdir } from "$scripts/utils/runtime";
import fs from "node:fs";
import path from "node:path";
import { emitSystemEvent } from "./events";
import { getTaskFilePath, getTaskStatus } from "./task-status";

const watchers = new Map<string, fs.FSWatcher>();

export async function startTaskWatcher(gallery: string, dataDir: string): Promise<void> {
  if (watchers.has(gallery)) {
    return; // Already watching
  }

  const taskFile = getTaskFilePath(dataDir);
  const watchDir = path.dirname(taskFile);

  // Ensure directory exists
  await mkdir(watchDir, { recursive: true });

  let previousStatus: Awaited<ReturnType<typeof getTaskStatus>> = null;

  const watcher = fs.watch(watchDir, async (_eventType, filename) => {
    if (filename !== path.basename(taskFile)) {
      return;
    }

    const currentStatus = await getTaskStatus(dataDir);

    // Task started
    if (currentStatus && !previousStatus) {
      emitSystemEvent(gallery, {
        type: "task:started",
        task: {
          id: currentStatus.id,
          label: currentStatus.label,
        },
      });
    }

    // Task completed (file removed)
    if (!currentStatus && previousStatus) {
      emitSystemEvent(gallery, {
        type: "task:completed",
        task: {
          id: previousStatus.id,
          label: previousStatus.label,
        },
      });
    }

    previousStatus = currentStatus;
  });

  watchers.set(gallery, watcher);
}

export function stopTaskWatcher(gallery: string): void {
  const watcher = watchers.get(gallery);
  if (watcher) {
    watcher.close();
    watchers.delete(gallery);
  }
}

export function stopAllWatchers(): void {
  for (const [gallery] of watchers) {
    stopTaskWatcher(gallery);
  }
}
