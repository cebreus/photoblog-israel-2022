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
} from "../../../src/lib/types/manifest";
import {
  type ClusteringConstraints,
  isValidAnalysisManifest,
  isValidClusteringConstraints,
  isValidCurationManifest,
  isValidEmbeddingsManifest,
  isValidFacesManifest,
  isValidManifest,
  isValidMenuManifest,
  isValidPeopleManifest,
} from "../../../src/lib/utils/manifest-validators";
import { createLogger } from "../core/cli-logger";

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
    logger.error({ err: e, filePath }, "Failed to save manifest");
    throw e;
  }
}
const MAX_MANIFEST_SIZE_BYTES = 30 * 1024 * 1024; // 30MB limit

export async function loadManifest<T>(filePath: string): Promise<T | null> {
  try {
    const stats = await fsp.stat(filePath);
    if (stats.size > MAX_MANIFEST_SIZE_BYTES) {
      logger.warn(
        { filePath, size: stats.size, limit: MAX_MANIFEST_SIZE_BYTES },
        "Manifest file exceeds size limit",
      );
      return null;
    }
    const content = await fsp.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return null;
    }
    logger.warn({ err: e, filePath }, "Failed to load manifest");
    return null;
  }
}

export async function loadImagesManifest(outRoot: string): Promise<Manifest | null> {
  const data = await loadManifest<Manifest>(path.join(outRoot, "images.manifest.json"));
  if (data && !isValidManifest(data)) {
    logger.warn({ outRoot }, "Invalid images manifest structure");
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
    logger.warn({ outRoot }, "Invalid menu manifest structure");
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
    logger.warn({ outRoot }, "Invalid curation manifest structure");
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
    logger.warn({ outRoot }, "Invalid people manifest structure");
    return null;
  }

  // Auto-migrate isUserNamed field if missing
  if (data?.people) {
    for (const person of data.people) {
      if (person.isUserNamed === undefined) {
        person.isUserNamed = !person.id.startsWith("person-") || person.id.includes("--");
      }
    }
  }

  return data;
}

export async function savePeopleManifest(outRoot: string, data: PeopleManifest): Promise<void> {
  return saveManifest(path.join(outRoot, "people.manifest.json"), data);
}

export async function loadAnalysisManifest(outRoot: string): Promise<AnalysisManifest | null> {
  const data = await loadManifest<AnalysisManifest>(path.join(outRoot, "analysis.manifest.json"));
  if (data && !isValidAnalysisManifest(data)) {
    logger.warn({ outRoot }, "Invalid analysis manifest structure");
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
    logger.warn({ outRoot }, "Invalid embeddings manifest structure");
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
    logger.warn({ outRoot }, "Invalid faces manifest structure");
    return null;
  }
  return data;
}

export async function saveFacesManifest(outRoot: string, data: FacesManifest): Promise<void> {
  return saveManifest(path.join(outRoot, "faces.manifest.json"), data);
}

export async function loadClusteringConstraints(
  outRoot: string,
): Promise<ClusteringConstraints | null> {
  const data = await loadManifest<ClusteringConstraints>(
    path.join(outRoot, "clustering-constraints.json"),
  );
  if (data && !isValidClusteringConstraints(data)) {
    logger.warn({ outRoot }, "Invalid clustering constraints structure");
    return null;
  }
  return data;
}

export async function saveClusteringConstraints(
  outRoot: string,
  data: ClusteringConstraints,
): Promise<void> {
  return saveManifest(path.join(outRoot, "clustering-constraints.json"), data);
}
