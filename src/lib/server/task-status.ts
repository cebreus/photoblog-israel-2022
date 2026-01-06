import fsp from "node:fs/promises";
import path from "node:path";

export type TaskStatus = {
  id: string;
  label: string;
  pid: number;
  startTime: number;
  progress?: number;
};

const TASK_FILE_NAME = ".task.json";

export function getTaskFilePath(dataDir: string): string {
  return path.join(dataDir, TASK_FILE_NAME);
}

export async function saveTaskStatus(
  dataDir: string,
  task: Omit<TaskStatus, "pid" | "startTime">,
): Promise<void> {
  const taskPath = getTaskFilePath(dataDir);
  const status: TaskStatus = {
    ...task,
    pid: process.pid,
    startTime: Date.now(),
  };

  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(taskPath, JSON.stringify(status, null, 2), "utf-8");
}

export async function clearTaskStatus(dataDir: string): Promise<void> {
  const taskPath = getTaskFilePath(dataDir);
  try {
    await fsp.unlink(taskPath);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw e;
    }
  }
}

export async function getTaskStatus(dataDir: string): Promise<TaskStatus | null> {
  const taskPath = getTaskFilePath(dataDir);
  try {
    const content = await fsp.readFile(taskPath, "utf-8");
    const status = JSON.parse(content) as TaskStatus;

    // Verify the process is still running
    try {
      process.kill(status.pid, 0);
      return status;
    } catch {
      // Process is dead, clean up stale file
      await clearTaskStatus(dataDir);
      return null;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw e;
  }
}
