import fsp from "node:fs/promises";
import path from "node:path";
import type {
  CurationManifest,
  Manifest,
  MenuManifest,
  PeopleManifest,
} from "../../src/lib/types/manifest";
import { createLogger } from "./logger";
import {
  isValidCurationManifest,
  isValidManifest,
  isValidMenuManifest,
  isValidPeopleManifest,
} from "./manifest-validators";

const logger = createLogger("manifest-repo");
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((sorted: any, key: string) => {
        sorted[key] = sortObjectKeys(obj[key]);
        return sorted;
      }, {});
  }
  return obj;
}
export async function saveManifest<T>(filePath: string, data: T, sortKeys = false): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fsp.mkdir(dir, { recursive: true });

    const content = sortKeys
      ? JSON.stringify(sortObjectKeys(data), null, 2)
      : JSON.stringify(data, null, 2);

    const tmpPath = `${filePath}.tmp`;
    await fsp.writeFile(tmpPath, content, "utf-8");
    await fsp.rename(tmpPath, filePath);
  } catch (e) {
    logger.error(`Failed to save manifest to ${filePath}:`, e);
    throw e;
  }
}
export async function loadManifest<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fsp.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return null;
    }
    logger.warn(`Failed to load manifest from ${filePath}: ${e.message}`);
    return null;
  }
}

export async function loadImagesManifest(outRoot: string): Promise<Manifest | null> {
  const data = await loadManifest<Manifest>(path.join(outRoot, "images.manifest.json"));
  if (data && !isValidManifest(data)) {
    logger.warn(`Invalid images manifest structure in ${outRoot}`);
    return null;
  }
  return data;
}

export async function saveImagesManifest(outRoot: string, data: Manifest): Promise<void> {
  return saveManifest(path.join(outRoot, "images.manifest.json"), data);
}

export async function loadMenuManifest(outRoot: string): Promise<MenuManifest | null> {
  const data = await loadManifest<MenuManifest>(path.join(outRoot, "menu.manifest.json"));
  if (data && !isValidMenuManifest(data)) {
    logger.warn(`Invalid menu manifest structure in ${outRoot}`);
    return null;
  }
  return data;
}

export async function saveMenuManifest(outRoot: string, data: MenuManifest): Promise<void> {
  return saveManifest(path.join(outRoot, "menu.manifest.json"), data);
}

export async function loadCurationManifest(outRoot: string): Promise<CurationManifest | null> {
  const data = await loadManifest<CurationManifest>(path.join(outRoot, "curation.manifest.json"));
  if (data && !isValidCurationManifest(data)) {
    logger.warn(`Invalid curation manifest structure in ${outRoot}`);
    return null;
  }
  return data;
}

export async function saveCurationManifest(outRoot: string, data: CurationManifest): Promise<void> {
  return saveManifest(path.join(outRoot, "curation.manifest.json"), data);
}

export async function loadPeopleManifest(outRoot: string): Promise<PeopleManifest | null> {
  const data = await loadManifest<PeopleManifest>(path.join(outRoot, "people.manifest.json"));
  if (data && !isValidPeopleManifest(data)) {
    logger.warn(`Invalid people manifest structure in ${outRoot}`);
    return null;
  }
  return data;
}

export async function savePeopleManifest(outRoot: string, data: PeopleManifest): Promise<void> {
  return saveManifest(path.join(outRoot, "people.manifest.json"), data);
}
