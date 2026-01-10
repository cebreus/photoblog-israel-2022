/**
 * @fileoverview Face embeddings manifest utilities (cache + helpers).
 *
 * @description
 * Provides cached accessors and helpers to read and query face embedding manifests.
 */
import type { Logger } from "$scripts/core/cli-logger";
import { loadFaceEmbeddingsManifest } from "$scripts/manifests/repository";
import type { FaceEmbeddingsManifest } from "../../../src/lib/types/manifest";

/**
 * Cache for embeddings manifest to avoid repeated disk reads
 */
let embeddingsCache: FaceEmbeddingsManifest | null = null;

/**
 * Load embeddings manifest with caching
 */
export async function loadEmbeddings(
  dataDir: string,
  log: Logger,
): Promise<FaceEmbeddingsManifest> {
  if (!embeddingsCache) {
    embeddingsCache = (await loadFaceEmbeddingsManifest(dataDir, log)) ?? {};
  }
  return embeddingsCache;
}

/**
 * Clear embeddings cache
 */
export function clearEmbeddingsCache() {
  embeddingsCache = null;
}

/**
 * Get face descriptor for a person (legacy single descriptor)
 */
export async function getFaceDescriptor(
  personId: string,
  dataDir: string,
  log: Logger,
): Promise<number[] | undefined> {
  const embeddings = await loadEmbeddings(dataDir, log);
  return embeddings[personId]?.faceDescriptor;
}

/**
 * Get clusters for a person
 */
export async function getClusters(
  personId: string,
  dataDir: string,
  log: Logger,
): Promise<
  | {
      centroid: number[];
      faceCount: number;
      year?: number;
      lastSeen?: string;
    }[]
  | undefined
> {
  const embeddings = await loadEmbeddings(dataDir, log);
  return embeddings[personId]?.clusters;
}

/**
 * Get the primary descriptor for a person (prefers clusters[0].centroid, falls back to faceDescriptor)
 */
export async function getPrimaryDescriptor(
  personId: string,
  dataDir: string,
  log: Logger,
): Promise<number[] | undefined> {
  const embeddings = await loadEmbeddings(dataDir, log);
  const personEmbeddings = embeddings[personId];
  if (!personEmbeddings) return undefined;

  // Prefer clusters if available
  if (personEmbeddings.clusters && personEmbeddings.clusters.length > 0) {
    return personEmbeddings.clusters[0].centroid;
  }

  // Fall back to legacy descriptor
  return personEmbeddings.faceDescriptor;
}
