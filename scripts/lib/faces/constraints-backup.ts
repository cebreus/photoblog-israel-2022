/**
 * Constraints Backup Utility
 *
 * Automatically backs up clustering-constraints.json before each face clustering run.
 * Maintains a rolling backup (keeps last 5 versions).
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../core/cli-logger";

const logger = createLogger("constraints-backup");

const BACKUP_DIR_NAME = ".constraints-backups";
const MAX_BACKUPS = 5;

/**
 * Create a backup of clustering-constraints.json
 *
 * @param dataDir - Path to the data directory
 * @returns Path to the backup file, or null if no constraints file exists
 */
export async function backupConstraints(dataDir: string): Promise<string | null> {
  const constraintsPath = path.join(dataDir, "clustering-constraints.json");

  try {
    await fsp.access(constraintsPath);
  } catch {
    // No constraints file to backup
    return null;
  }

  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  await fsp.mkdir(backupDir, { recursive: true });

  // Create timestamped backup filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `constraints-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFilename);

  // Copy constraints to backup
  await fsp.copyFile(constraintsPath, backupPath);
  logger.info({ backupFilename }, "Backed up constraints");

  // Cleanup old backups (keep only MAX_BACKUPS)
  await cleanupOldBackups(backupDir);

  return backupPath;
}

/**
 * Remove old backup files, keeping only the most recent ones
 */
async function cleanupOldBackups(backupDir: string): Promise<void> {
  try {
    const files = await fsp.readdir(backupDir);
    const backupFiles = files
      .filter((f) => f.startsWith("constraints-") && f.endsWith(".json"))
      .sort()
      .reverse(); // Newest first

    if (backupFiles.length > MAX_BACKUPS) {
      const toDelete = backupFiles.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        await fsp.unlink(path.join(backupDir, file));
        logger.verbose({ file }, "Removed old backup");
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * List available backup files
 */
export async function listBackups(dataDir: string): Promise<string[]> {
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  try {
    const files = await fsp.readdir(backupDir);
    return files
      .filter((f) => f.startsWith("constraints-") && f.endsWith(".json"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Restore constraints from a specific backup
 */
export async function restoreConstraints(
  dataDir: string,
  backupFilename: string,
): Promise<boolean> {
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  const backupPath = path.join(backupDir, backupFilename);
  const constraintsPath = path.join(dataDir, "clustering-constraints.json");

  try {
    await fsp.access(backupPath);
    await fsp.copyFile(backupPath, constraintsPath);
    logger.info({ backupFilename }, "Restored constraints");
    return true;
  } catch {
    logger.error({ backupFilename }, "Failed to restore backup");
    return false;
  }
}
