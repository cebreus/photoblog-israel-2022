import type { CurationManifest } from "$lib/types/manifest";
import {
  isValidAnalysisManifest,
  isValidClusteringConstraints,
  isValidCurationManifest,
  isValidEmbeddingsManifest,
  isValidFacesManifest,
  isValidManifest,
  isValidMenuManifest,
  isValidPeopleManifest,
} from "$lib/utils/manifest-validators";
import { enrichPeopleWithStats } from "$lib/utils/people";
import type {
  AnalysisManifest,
  ClusteringConstraints,
  EmbeddingsManifest,
  FaceEmbeddingsManifest,
  FacesManifest,
  Manifest,
  ManifestMeta,
  MenuManifest,
  PeopleManifest,
} from "$shared/types/manifest";
import path from "node:path";
import { createLogger, type Logger } from "$scripts/core/cli-logger";
import { mkdir, readFileText, rename, stat, unlink, writeFile } from "$scripts/utils/runtime";

const logger = createLogger("manifest-repo");

function updateManifestMeta<T extends { meta?: ManifestMeta }>(data: T): T {
  const now = new Date().toISOString();
  const currentVersion = data.meta?.version ?? 0;

  // Clone to avoid mutation side-effects if object is reused
  return {
    ...data,
    meta: {
      version: currentVersion + 1,
      generatedAt: now,
      generator: "photoblog-data-layer",
    },
  };
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce((sorted: Record<string, unknown>, key: string) => {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
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
    await mkdir(dir, { recursive: true });

    const content = sortKeys
      ? JSON.stringify(sortObjectKeys(data), null, 2)
      : JSON.stringify(data, null, 2);

    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, content);
    await rename(tmpPath, filePath);
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
      await mkdir(dir, { recursive: true });

      const content = manifest.sortKeys
        ? JSON.stringify(sortObjectKeys(manifest.data), null, 2)
        : JSON.stringify(manifest.data, null, 2);

      const tmpPath = `${manifest.filePath}.tmp`;
      tmpPaths.push(tmpPath);

      await writeFile(tmpPath, content);
      log.debug({ manifest: manifest.name }, "Written to temp file");
    }

    // Phase 2: Atomic rename all temp files to final
    // Note: rename() is atomic on POSIX for single file operations
    for (const manifest of manifests) {
      await rename(`${manifest.filePath}.tmp`, manifest.filePath);
      log.debug({ manifest: manifest.name }, "Renamed to final");
    }

    log.info({ count: manifests.length }, "All manifests saved atomically");
  } catch (e: unknown) {
    // Rollback: cleanup any temp files that were created
    log.error({ err: e }, "Atomic save failed, cleaning up temp files");
    for (const manifest of manifests) {
      await unlink(`${manifest.filePath}.tmp`).catch(() => {});
    }
    throw e;
  }
}
const MAX_MANIFEST_SIZE_BYTES = 30 * 1024 * 1024; // 30MB limit

export async function loadManifest<T>(filePath: string, log: Logger = logger): Promise<T | null> {
  try {
    const stats = await stat(filePath);
    if (stats.size > MAX_MANIFEST_SIZE_BYTES) {
      log.warn(
        { filePath, size: stats.size, limit: MAX_MANIFEST_SIZE_BYTES },
        "Manifest file exceeds size limit",
      );
      return null;
    }
    const content = await readFileText(filePath);
    return JSON.parse(content) as T;
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "ENOENT") {
      return null;
    }
    log.warn(
      { err: e instanceof Error ? e.message : String(e), filePath },
      "Failed to load manifest",
    );
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
  const versionedDate = updateManifestMeta(data);
  return saveManifest(path.join(outRoot, "images.manifest.json"), versionedDate, false, log);
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
  const versionedData = updateManifestMeta(data);
  return saveManifest(path.join(outRoot, "people.manifest.json"), versionedData, false, log);
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
  // 1. Enrich: Recalculate face counts based on the current state of images
  // This moves the O(N) calculation from Frontend load time to Backend write time
  if (manifests.people.people && manifests.images.photoDays) {
    manifests.people.people = enrichPeopleWithStats(
      manifests.people.people,
      manifests.images.photoDays,
    );
  }

  // 2. Version: Increment metadata versions
  const versionedPeople = updateManifestMeta(manifests.people);
  const versionedImages = updateManifestMeta(manifests.images);

  // Note: Faces and Constraints generally don't utilize meta/versioning yet, but could in future.

  return saveManifestsAtomically(
    [
      {
        name: "people",
        filePath: path.join(outRoot, "people.manifest.json"),
        data: versionedPeople,
      },
      {
        name: "images",
        filePath: path.join(outRoot, "images.manifest.json"),
        data: versionedImages,
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
