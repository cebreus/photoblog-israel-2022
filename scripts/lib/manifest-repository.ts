import fsp from "node:fs/promises";
import path from "node:path";
import type {
  AnalysisManifest,
  CurationManifest,
  EmbeddingsManifest,
  FacesManifest,
  Manifest,
  MenuManifest,
  PeopleManifest,
} from "../../src/lib/types/manifest";
import {
  isValidAnalysisManifest,
  isValidCurationManifest,
  isValidEmbeddingsManifest,
  isValidFacesManifest,
  isValidManifest,
  isValidMenuManifest,
  isValidPeopleManifest,
} from "../../src/lib/utils/manifest-validators";
import { createLogger } from "./logger";

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
const MAX_MANIFEST_SIZE_BYTES = 30 * 1024 * 1024; // 30MB limit

export async function loadManifest<T>(filePath: string): Promise<T | null> {
  try {
    const stats = await fsp.stat(filePath);
    if (stats.size > MAX_MANIFEST_SIZE_BYTES) {
      logger.warn(
        `Manifest file ${filePath} exceeds size limit of ${MAX_MANIFEST_SIZE_BYTES} bytes.`,
      );
      return null;
    }
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

export async function loadAnalysisManifest(outRoot: string): Promise<AnalysisManifest | null> {
  const data = await loadManifest<AnalysisManifest>(path.join(outRoot, "analysis.manifest.json"));
  if (data && !isValidAnalysisManifest(data)) {
    logger.warn(`Invalid analysis manifest structure in ${outRoot}`);
    return null;
  }
  return data;
}

export async function saveAnalysisManifest(outRoot: string, data: AnalysisManifest): Promise<void> {
  return saveManifest(path.join(outRoot, "analysis.manifest.json"), data);
}

export async function loadEmbeddingsManifest(outRoot: string): Promise<EmbeddingsManifest | null> {
  const data = await loadManifest<EmbeddingsManifest>(
    path.join(outRoot, "embeddings.manifest.json"),
  );
  if (data && !isValidEmbeddingsManifest(data)) {
    logger.warn(`Invalid embeddings manifest structure in ${outRoot}`);
    return null;
  }
  return data;
}

export async function saveEmbeddingsManifest(
  outRoot: string,
  data: EmbeddingsManifest,
): Promise<void> {
  return saveManifest(path.join(outRoot, "embeddings.manifest.json"), data);
}

export async function loadFacesManifest(outRoot: string): Promise<FacesManifest | null> {
  const data = await loadManifest<FacesManifest>(path.join(outRoot, "faces.manifest.json"));
  if (data && !isValidFacesManifest(data)) {
    logger.warn(`Invalid faces manifest structure in ${outRoot}`);
    return null;
  }
  return data;
}

export async function saveFacesManifest(outRoot: string, data: FacesManifest): Promise<void> {
  return saveManifest(path.join(outRoot, "faces.manifest.json"), data);
}
