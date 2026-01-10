#!/usr/bin/env bun
/**
 * @fileoverview Deployment helper for publishing a gallery/site.
 *
 * @description
 * Handles versioning, manifest comparison, and uploading artifacts to target hosts.
 */
import { createLogger } from "$scripts/core/cli-logger";
import { listAvailableGalleries } from "$scripts/gallery/resolver";
import { cp, directoryExists, readdir, readFileText, rm, writeFile } from "$scripts/utils/runtime";
import { run } from "$scripts/utils/shell";
import type { ImageEntry } from "$shared/types/manifest";
import { cancel, confirm, intro, isCancel, note, outro, select, text } from "@clack/prompts";
import path from "node:path";
import { parseArgs } from "node:util";

type ImageManifest = Record<string, ImageEntry>;
type SemanticVersion = { major: number; minor: number; patch: number };

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const VERSION_ATTR_PATTERN = /data-version="([^"]+)"/;

const logger = createLogger("deploy");

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    gallery: { type: "string", short: "g" },
    target: { type: "string", short: "t" },
    help: { type: "boolean", short: "h" },
    push: { type: "boolean" },
    "dry-run": { type: "boolean" },
  },
  strict: false,
});

// --- Version utilities ---

function parseSemanticVersion(versionString: string): SemanticVersion {
  const [major, minor, patch] = versionString.split(".").map(Number);
  return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

function formatSemanticVersion(version: SemanticVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function isValidSemanticVersion(versionString: string): boolean {
  return SEMVER_PATTERN.test(versionString);
}

function computeNextVersions(current: SemanticVersion) {
  return {
    patch: formatSemanticVersion({ ...current, patch: current.patch + 1 }),
    minor: formatSemanticVersion({ ...current, minor: current.minor + 1, patch: 0 }),
    major: formatSemanticVersion({ major: current.major + 1, minor: 0, patch: 0 }),
  };
}

// --- File utilities ---

async function readDeployedVersion(targetDir: string): Promise<string> {
  try {
    const indexHtml = await readFileText(path.join(targetDir, "index.html"));
    const match = indexHtml.match(VERSION_ATTR_PATTERN);
    return match ? match[1] : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function cleanDirectoryExceptGit(targetDir: string): Promise<void> {
  const entries = await readdir(targetDir);
  const exempt = [".git", "CNAME", ".nojekyll", "README.md", "readme.md"];

  for (const entry of entries) {
    if (exempt.includes(entry)) continue;
    await rm(path.join(targetDir, entry), { recursive: true });
  }
}

// --- Manifest comparison ---

async function compareManifests(
  oldManifestPath: string,
  newManifestPath: string,
): Promise<{ added: string[]; removed: string[]; changed: string[] } | null> {
  try {
    const [oldContent, newContent] = await Promise.all([
      readFileText(oldManifestPath),
      readFileText(newManifestPath),
    ]);

    const oldManifest = JSON.parse(oldContent) as ImageManifest;
    const newManifest = JSON.parse(newContent) as ImageManifest;

    const oldIds = new Set(Object.keys(oldManifest));
    const newIds = new Set(Object.keys(newManifest));

    const added = [...newIds].filter(function (id) {
      return !oldIds.has(id);
    });
    const removed = [...oldIds].filter(function (id) {
      return !newIds.has(id);
    });
    const changed = [...newIds].filter(function (id) {
      return oldIds.has(id) && JSON.stringify(oldManifest[id]) !== JSON.stringify(newManifest[id]);
    });

    return { added, removed, changed };
  } catch {
    return null;
  }
}

// --- Interactive prompts ---

async function promptGallerySelection(): Promise<string> {
  const galleries = await listAvailableGalleries();

  if (galleries.length === 0) {
    logger.error({}, "No galleries found in content directory");
    process.exit(1);
  }

  const selected = await select({
    message: "Select a gallery to deploy:",
    options: galleries.map(function (name) {
      return { value: name, label: name };
    }),
    initialValue: galleries[0],
  });

  if (isCancel(selected)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return selected as string;
}

async function promptTargetDirectory(defaultTarget: string): Promise<string> {
  const input = await text({
    message: "Target repository directory not found. Please enter path:",
    placeholder: defaultTarget,
    initialValue: defaultTarget,
  });

  if (isCancel(input)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return input as string;
}

async function promptVersionSelection(currentVersionString: string): Promise<string> {
  const currentVersion = parseSemanticVersion(currentVersionString);
  const nextVersions = computeNextVersions(currentVersion);

  const selected = await select({
    message: `Current version is ${currentVersionString}. Select new version:`,
    options: [
      {
        value: nextVersions.patch,
        label: `Patch (${nextVersions.patch}) - Bug fixes, data updates`,
      },
      { value: nextVersions.minor, label: `Minor (${nextVersions.minor}) - New features` },
      { value: nextVersions.major, label: `Major (${nextVersions.major}) - Breaking changes` },
      { value: "custom", label: "Custom version..." },
    ],
  });

  if (isCancel(selected)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  if (selected === "custom") {
    const customVersion = await text({
      message: "Enter custom version (X.Y.Z):",
      placeholder: "1.0.0",
    });

    if (isCancel(customVersion)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    const versionString = customVersion as string;

    if (!isValidSemanticVersion(versionString)) {
      logger.error({ version: versionString }, "Invalid version format. Use X.Y.Z");
      process.exit(1);
    }

    return versionString;
  }

  return selected as string;
}

async function promptAppChanges(): Promise<string> {
  const changes = await text({
    message: "Describe app/frontend changes (press Enter if none):",
    placeholder: "e.g. Fixed zoom bug, added new filter...",
  });

  if (isCancel(changes)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return (changes as string) || "";
}

// --- Build and deploy operations ---

async function executeBuild(gallery: string, version: string): Promise<string> {
  const buildDir = path.resolve(process.cwd(), `build-${gallery}`);

  logger.info({ gallery, version }, "Building project...");

  await run("bun", ["run", "build", "-g", gallery], {
    env: { ...process.env, PUBLIC_VERSION: version },
  });

  const buildExists = await directoryExists(buildDir);
  if (!buildExists) {
    throw new Error(`Build failed: output directory ${buildDir} does not exist`);
  }

  return buildDir;
}

async function syncBuildToTarget(
  buildDir: string,
  targetDir: string,
  manifestPath: string,
): Promise<void> {
  logger.info({ targetDir }, "Cleaning target directory...");
  await cleanDirectoryExceptGit(targetDir);

  logger.info({ buildDir, targetDir }, "Copying build to target...");
  await cp(buildDir, targetDir, { recursive: true });

  // Save manifest for future diffs
  await cp(manifestPath, path.join(targetDir, "manifest-dump.json"));

  // Create .nojekyll to bypass Jekyll processing on GitHub Pages (it blocks _app/ directory)
  await writeFile(path.join(targetDir, ".nojekyll"), "");
}

async function commitChanges(
  targetDir: string,
  version: string,
  changeNotes: string[],
): Promise<boolean> {
  logger.info({ targetDir }, "Checking for changes...");

  const statusResult = (await run("git", ["status", "--porcelain"], {
    cwd: targetDir,
    captureOutput: true,
  })) as { stdout: string; stderr: string };

  if (!statusResult.stdout.trim()) {
    logger.info({ targetDir }, "No changes to commit.");
    return false;
  }

  const commitBody = changeNotes.length > 0 ? changeNotes.join("\n") : "Maintenance update";
  const commitMessage = `Release ${version}\n\n${commitBody}`;

  await run("git", ["add", "."], { cwd: targetDir });
  await run("git", ["commit", "-m", commitMessage], { cwd: targetDir });

  logger.info({ targetDir, version }, "Changes committed.");
  return true;
}

async function pushChanges(targetDir: string): Promise<void> {
  await run("git", ["push"], { cwd: targetDir });
  logger.info({ targetDir }, "Changes pushed to remote.");
}

// --- Help ---

function printHelp(): void {
  process.stdout.write(`
  Usage: bun scripts/deploy.ts [options]

  Options:
    -g, --gallery <name>   Gallery to deploy
    -t, --target <path>    Target repository directory
    --push                 Push changes to remote after commit
    --dry-run              Show what would be done without executing
    -h, --help             Show this help

  Examples:
    bun scripts/deploy.ts -g egypt-2025
    bun scripts/deploy.ts -g egypt-2025 --push
    bun scripts/deploy.ts -g egypt-2025 -t ../my-photoblog --dry-run

`);
}

// --- Main ---

async function main(): Promise<void> {
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const isDryRun = values["dry-run"] === true;

  intro(`🚀 Photoblog Deployer${isDryRun ? " (DRY RUN)" : ""}`);

  // 1. Resolve gallery
  const gallery = (values.gallery as string) || (await promptGallerySelection());

  // 2. Resolve target directory
  const cwd = process.cwd();
  const defaultTarget = path.resolve(cwd, `../photoblog-${gallery}`);
  let targetDir = (values.target as string) || defaultTarget;

  const targetExists = await directoryExists(targetDir);
  if (!targetExists) {
    if (values.target) {
      logger.error({ targetDir }, "Target directory does not exist.");
      process.exit(1);
    }
    targetDir = await promptTargetDirectory(defaultTarget);
    const retryExists = await directoryExists(targetDir);
    if (!retryExists) {
      logger.error({ targetDir }, "Target directory does not exist.");
      process.exit(1);
    }
  }

  // 3. Version selection
  const currentVersion = await readDeployedVersion(targetDir);
  const newVersion = await promptVersionSelection(currentVersion);

  // 4. Manifest diff
  const changeNotes: string[] = [];
  const oldManifestPath = path.join(targetDir, "manifest-dump.json");
  const newManifestPath = path.resolve(cwd, `src/data/${gallery}/images.manifest.json`);

  const manifestDiff = await compareManifests(oldManifestPath, newManifestPath);
  if (manifestDiff) {
    if (manifestDiff.added.length > 0)
      changeNotes.push(`Data: +${manifestDiff.added.length} new photos`);
    if (manifestDiff.removed.length > 0)
      changeNotes.push(`Data: -${manifestDiff.removed.length} removed photos`);
    if (manifestDiff.changed.length > 0)
      changeNotes.push(`Data: ${manifestDiff.changed.length} updated photos`);
    note(changeNotes.join("\n") || "No changes in photo manifest detected.", "Data Diff");
  } else {
    note("Could not compare with previous manifest (file missing in target).", "Data Diff");
    changeNotes.push("Data: Manifest update");
  }

  // 5. App changes description
  const appChanges = await promptAppChanges();
  if (appChanges) {
    changeNotes.push(`App: ${appChanges}`);
  }

  // 6. Confirmation
  const shouldProceed = await confirm({
    message: `Ready to build version ${newVersion} for '${gallery}' and deploy to '${targetDir}'?`,
  });

  if (isCancel(shouldProceed) || !shouldProceed) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  if (isDryRun) {
    note(
      `Would build: ${gallery} v${newVersion}\nWould deploy to: ${targetDir}\nChanges:\n${changeNotes.join("\n")}`,
      "Dry Run Summary",
    );
    outro("Dry run complete. No changes made.");
    process.exit(0);
  }

  // 7. Build
  let buildDir: string;
  try {
    buildDir = await executeBuild(gallery, newVersion);
  } catch (error) {
    logger.error({ error: (error as Error).message }, "Build failed");
    process.exit(1);
  }

  // 8. Sync to target
  await syncBuildToTarget(buildDir, targetDir, newManifestPath);

  // 9. Git operations
  const hasChanges = await commitChanges(targetDir, newVersion, changeNotes);

  if (hasChanges) {
    const shouldPush =
      values.push === true ||
      (values.push === undefined &&
        (await confirm({
          message: "Push changes to remote?",
          initialValue: false,
        })));

    if (shouldPush && !isCancel(shouldPush)) {
      await pushChanges(targetDir);
      outro("🎉 Deployed and pushed successfully!");
    } else {
      outro("✅ Deployed locally. Changes committed but not pushed.");
    }
  } else {
    outro("Done. No changes detected.");
  }
}

main();
