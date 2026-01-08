import type {
  AnalysisManifest,
  ClusteringConstraints,
  EmbeddingsManifest,
  FaceEmbeddingsManifest,
  FacesManifest,
  Manifest,
  MenuManifest,
  PeopleManifest,
} from "$shared/types/manifest";
import fsp from "node:fs/promises";
import path from "node:path";
import type { CurationManifest } from "../../../src/lib/types/manifest";
import {
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

/**
 * Manifest entry for atomic save operation
 */
interface ManifestEntry {
  name: string;
  filePath: string;
  data: unknown;
  sortKeys?: boolean;
}

/**
 * Atomically saves multiple manifests.
 *
 * Pattern:
 * 1. Write all manifests to .tmp files
 * 2. Rename all .tmp files to final names (atomic on POSIX)
 * 3. On any failure, cleanup all .tmp files
 *
 * This ensures either ALL manifests are saved, or NONE are.
 */
export async function saveManifestsAtomically(
  manifests: ManifestEntry[],
  log: Logger = logger,
): Promise<void> {
  const tmpPaths: string[] = [];

  try {
    // Phase 1: Write all to temp files
    for (const manifest of manifests) {
      const dir = path.dirname(manifest.filePath);
      await fsp.mkdir(dir, { recursive: true });

      const content = manifest.sortKeys
        ? JSON.stringify(sortObjectKeys(manifest.data), null, 2)
        : JSON.stringify(manifest.data, null, 2);

      const tmpPath = `${manifest.filePath}.tmp`;
      tmpPaths.push(tmpPath);

      await fsp.writeFile(tmpPath, content, "utf-8");
      log.debug({ manifest: manifest.name }, "Written to temp file");
    }

    // Phase 2: Atomic rename all temp files to final
    // Note: rename() is atomic on POSIX for single file operations
    for (let i = 0; i < manifests.length; i++) {
      await fsp.rename(tmpPaths[i], manifests[i].filePath);
      log.debug({ manifest: manifests[i].name }, "Renamed to final");
    }

    log.info({ count: manifests.length }, "All manifests saved atomically");
  } catch (e) {
    // Rollback: cleanup any temp files that were created
    log.error({ err: e }, "Atomic save failed, cleaning up temp files");

    for (const tmpPath of tmpPaths) {
      try {
        await fsp.unlink(tmpPath);
      } catch {
        // Ignore cleanup errors (file may not exist)
      }
    }

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

export async function loadFaceEmbeddingsManifest(
  outRoot: string,
  log: Logger = logger,
): Promise<FaceEmbeddingsManifest | null> {
  const data = await loadManifest<FaceEmbeddingsManifest>(
    path.join(outRoot, "face-embeddings.manifest.json"),
    log,
  );
  // No validator yet - just check if it's an object
  if (data && typeof data !== "object") {
    log.warn({ outRoot }, "Invalid face embeddings manifest structure");
    return null;
  }
  return data;
}

export async function saveFaceEmbeddingsManifest(
  outRoot: string,
  data: FaceEmbeddingsManifest,
  log: Logger = logger,
): Promise<void> {
  return saveManifest(path.join(outRoot, "face-embeddings.manifest.json"), data, false, log);
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

/**
 * Manifests bundle for people-related operations
 */
interface PeopleManifestsBundle {
  people: PeopleManifest;
  images: Manifest;
  faces: FacesManifest;
  constraints: ClusteringConstraints;
}

/**
 * Atomically saves all people-related manifests.
 * Use this instead of individual save calls during merge/rename/unmatch operations.
 */
export async function savePeopleRelatedManifests(
  outRoot: string,
  manifests: PeopleManifestsBundle,
  log: Logger = logger,
): Promise<void> {
  return saveManifestsAtomically(
    [
      {
        name: "people",
        filePath: path.join(outRoot, "people.manifest.json"),
        data: manifests.people,
      },
      {
        name: "images",
        filePath: path.join(outRoot, "images.manifest.json"),
        data: manifests.images,
      },
      {
        name: "faces",
        filePath: path.join(outRoot, "faces.manifest.json"),
        data: manifests.faces,
      },
      {
        name: "constraints",
        filePath: path.join(outRoot, "clustering-constraints.json"),
        data: manifests.constraints,
      },
    ],
    log,
  );
}
