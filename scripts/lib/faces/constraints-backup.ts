/**
 * @fileoverview Constraints backup utilities for clustering constraints.
 *
 * @description
 * Creates timestamped backups and manages retention for clustering constraints files.
 */

import { createLogger } from "$scripts/core/cli-logger";
import {
  copyFile,
  directoryExists,
  fileExists,
  mkdir,
  readdir,
  unlink,
} from "$scripts/utils/runtime";
import path from "node:path";

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

  if (!(await fileExists(constraintsPath))) {
    // No constraints file to backup
    return null;
  }

  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  await mkdir(backupDir, { recursive: true });

  // Create timestamped backup filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `constraints-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFilename);

  // Copy constraints to backup
  await copyFile(constraintsPath, backupPath);
  logger.info({ backupFilename }, "Backed up constraints");

  // Cleanup old backups (keep only MAX_BACKUPS)
  await cleanupOldBackups(backupDir);

  return backupPath;
}

/**
 * Remove old backup files, keeping only the most recent ones
 */
async function cleanupOldBackups(backupDir: string): Promise<void> {
  if (!(await directoryExists(backupDir))) return;

  const files = await readdir(backupDir);
  const backupFiles = files
    .filter((file: string) => file.startsWith("constraints-") && file.endsWith(".json"))
    .sort()
    .reverse(); // Newest first

  if (backupFiles.length > MAX_BACKUPS) {
    const toDelete = backupFiles.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      await unlink(path.join(backupDir, file));
      logger.verbose({ file }, "Removed old backup");
    }
  }
}

/**
 * List available backup files
 */
export async function listBackups(dataDir: string): Promise<string[]> {
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  if (!(await directoryExists(backupDir))) return [];

  const files = await readdir(backupDir);
  return files
    .filter((file: string) => file.startsWith("constraints-") && file.endsWith(".json"))
    .sort()
    .reverse();
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

  if (!(await fileExists(backupPath))) {
    logger.error({ backupFilename }, "Backup not found");
    return false;
  }

  await copyFile(backupPath, constraintsPath);
  logger.info({ backupFilename }, "Restored constraints");
  return true;
}
