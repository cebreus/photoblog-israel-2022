import { select } from "@clack/prompts";
import fsp from "node:fs/promises";
import path from "node:path";

const CONTENT_ROOT = path.resolve("content");
const DEFAULT_GALLERY = "egypt-2025";

function isDirectory(entry: { isDirectory(): boolean }) {
  return entry.isDirectory();
}

function extractName(entry: { name: string }) {
  return entry.name;
}

function createSelectOption(galleryName: string) {
  return { value: galleryName, label: galleryName };
}

async function listAvailableGalleries(): Promise<string[]> {
  const entries = await fsp.readdir(CONTENT_ROOT, { withFileTypes: true });
  return entries.filter(isDirectory).map(extractName);
}

export async function resolveGalleryDirectory(): Promise<string> {
  const fromEnvironment = process.env.CONTENT_DIR;
  if (fromEnvironment) {
    return fromEnvironment;
  }

  const galleries = await listAvailableGalleries();

  if (galleries.length === 0) {
    throw new Error("No galleries found in content directory");
  }

  if (galleries.length === 1) {
    return galleries[0];
  }

  const selected = await select({
    message: "Select gallery:",
    options: galleries.map(createSelectOption),
    initialValue: DEFAULT_GALLERY,
  });

  if (typeof selected !== "string") {
    process.exit(0);
  }

  return selected;
}

export { listAvailableGalleries };
