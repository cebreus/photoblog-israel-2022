#!/usr/bin/env bun
/**
 * Antigravity Watchdog 🛡️
 *
 * Monitors data consistency in real-time while you work in the GUI.
 * Alerts immediately if bad data patterns are detected.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createLogger } from "./lib/core/cli-logger";

const logger = createLogger("watchdog");
const contentDir = process.env.CONTENT_DIR || "egypt-2025";
const DATA_DIR = path.resolve(process.cwd(), "src/data", contentDir);
const FACES_DIR = path.resolve(process.cwd(), "static", contentDir, "faces");

logger.info(`🛡️  Antigravity Watchdog active for: ${contentDir}`);
logger.info("   Watching for data corruption, zombies, and nested names...");

async function check() {
  try {
    const peoplePath = path.join(DATA_DIR, "people.manifest.json");
    if (!(await fs.stat(peoplePath).catch(() => false))) return;

    const peopleData = JSON.parse(await fs.readFile(peoplePath, "utf-8"));
    const people = peopleData.people || [];

    let issues = 0;

    // 1. Check for Nested Names
    const nested = people.filter((p: any) => p.name.includes("Odpojeno od Odpojeno od"));
    if (nested.length > 0) {
      logger.error(`❌ CRITICAL: Detected ${nested.length} nested names!`);
      for (const p of nested) {
        console.log(`   - ${p.name} (${p.id})`);
      }
      issues++;
      // TODO: Auto-fix logic could go here
    }

    // 2. Check for Zombies (No face crops)
    // We sample a few people to keep it fast
    for (const p of people) {
      const personDir = path.join(FACES_DIR, p.id);
      const exists = await fs.stat(personDir).catch(() => false);
      if (!exists && p.faceCount > 0) {
        logger.warn(
          `⚠️  ZOMBIE DETECTED: ${p.name} (${p.id}) has faceCount ${p.faceCount} but no folder!`,
        );
        issues++;
      } else if (exists) {
        const files = await fs.readdir(personDir);
        const jpgs = files.filter((f) => f.endsWith(".jpg"));
        // Allow some sync delay, but warn if difference is huge
        if (Math.abs(jpgs.length - p.faceCount) > 2) {
          // logger.warn(`❓ SYNC: ${p.name} count mismatch (Manifest: ${p.faceCount}, Disk: ${jpgs.length})`);
        }
        if (jpgs.length === 0 && p.faceCount > 0) {
          logger.warn(`⚠️  EMPTY FOLDER: ${p.name} has folder but no crops!`);
          issues++;
        }
      }
    }

    if (issues === 0) {
      process.stdout.write("."); // Heartbeat
    }
  } catch (e) {
    logger.error("Check failed:", e);
  }
}

// Run check every 5 seconds
setInterval(check, 5000);
check();
