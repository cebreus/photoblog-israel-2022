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
import { createLogger, type Logger } from "../core/cli-logger";

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
export async function saveManifest<T>(
  filePath: string,
  data: T,
  sortKeys = false,
  log: Logger = logger,
): Promise<void> {
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
    log.error({ err: e, filePath }, "Failed to save manifest");
    throw e;
  }
}
const MAX_MANIFEST_SIZE_BYTES = 30 * 1024 * 1024; // 30MB limit

export async function loadManifest<T>(filePath: string, log: Logger = logger): Promise<T | null> {
  try {
    const stats = await fsp.stat(filePath);
    if (stats.size > MAX_MANIFEST_SIZE_BYTES) {
      log.warn(
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
    log.warn({ err: e, filePath }, "Failed to load manifest");
    return null;
  }
}

export async function loadImagesManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<Manifest | null> {
  const data = await loadManifest<Manifest>(path.join(outRoot, "images.manifest.json"), log);
  if (data && !isValidManifest(data)) {
    log.warn({ outRoot }, "Invalid images manifest structure");
    return null;
  }
  return data;
}

export async function saveImagesManifest(
  outRoot: string,
  data: Manifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "images.manifest.json"), data, false, log);
}

export async function loadMenuManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<MenuManifest | null> {
  const data = await loadManifest<MenuManifest>(path.join(outRoot, "menu.manifest.json"), log);
  if (data && !isValidMenuManifest(data)) {
    log.warn({ outRoot }, "Invalid menu manifest structure");
    return null;
  }
  return data;
}

export async function saveMenuManifest(
  outRoot: string,
  data: MenuManifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "menu.manifest.json"), data, false, log);
}

export async function loadCurationManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<CurationManifest | null> {
  const data = await loadManifest<CurationManifest>(
    path.join(outRoot, "curation.manifest.json"),
    log,
  );
  if (data && !isValidCurationManifest(data)) {
    log.warn({ outRoot }, "Invalid curation manifest structure");
    return null;
  }
  return data;
}

export async function saveCurationManifest(
  outRoot: string,
  data: CurationManifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "curation.manifest.json"), data, false, log);
}

export async function loadPeopleManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<PeopleManifest | null> {
  const data = await loadManifest<PeopleManifest>(path.join(outRoot, "people.manifest.json"), log);
  if (data && !isValidPeopleManifest(data)) {
    log.warn({ outRoot }, "Invalid people manifest structure");
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

export async function savePeopleManifest(
  outRoot: string,
  data: PeopleManifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "people.manifest.json"), data, false, log);
}

export async function loadAnalysisManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<AnalysisManifest | null> {
  const data = await loadManifest<AnalysisManifest>(
    path.join(outRoot, "analysis.manifest.json"),
    log,
  );
  if (data && !isValidAnalysisManifest(data)) {
    log.warn({ outRoot }, "Invalid analysis manifest structure");
    return null;
  }
  return data;
}

export async function saveAnalysisManifest(
  outRoot: string,
  data: AnalysisManifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "analysis.manifest.json"), data, false, log);
}

export async function loadEmbeddingsManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<EmbeddingsManifest | null> {
  const data = await loadManifest<EmbeddingsManifest>(
    path.join(outRoot, "embeddings.manifest.json"),
    log,
  );
  if (data && !isValidEmbeddingsManifest(data)) {
    log.warn({ outRoot }, "Invalid embeddings manifest structure");
    return null;
  }
  return data;
}

export async function saveEmbeddingsManifest(
  outRoot: string,
  data: EmbeddingsManifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "embeddings.manifest.json"), data, false, log);
}

export async function loadFacesManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<FacesManifest | null> {
  const data = await loadManifest<FacesManifest>(path.join(outRoot, "faces.manifest.json"), log);
  if (data && !isValidFacesManifest(data)) {
    log.warn({ outRoot }, "Invalid faces manifest structure");
    return null;
  }
  return data;
}

export async function saveFacesManifest(
  outRoot: string,
  data: FacesManifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "faces.manifest.json"), data, false, log);
}

export async function loadClusteringConstraints(
  outRoot: string,
  log: Logger = logger,
): Promise<ClusteringConstraints | null> {
  const data = await loadManifest<ClusteringConstraints>(
    path.join(outRoot, "clustering-constraints.json"),
    log,
  );
  if (data && !isValidClusteringConstraints(data)) {
    log.warn({ outRoot }, "Invalid clustering constraints structure");
    return null;
  }
  return data;
}

export async function saveClusteringConstraints(
  outRoot: string,
  data: ClusteringConstraints,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "clustering-constraints.json"), data, false, log);
}
