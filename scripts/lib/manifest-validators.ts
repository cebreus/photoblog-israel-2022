import type {
  Cache,
  CurationManifest,
  ImageEntry,
  Manifest,
  MenuManifest,
  PeopleManifest,
  Person,
  PhotoDay,
} from "../../src/lib/types/manifest";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isValidPerson(value: unknown): value is Person {
  if (!isObject(value)) return false;

  return (
    isString(value.id) &&
    isString(value.name) &&
    isArray(value.faceDescriptor) &&
    isNumber(value.faceCount) &&
    isString(value.thumbnail) &&
    isBoolean(value.ignored) &&
    isString(value.createdAt) &&
    isString(value.lastSeenAt)
  );
}

export function isValidPeopleManifest(value: unknown): value is PeopleManifest {
  if (!isObject(value)) return false;
  if (!isArray(value.people)) return false;

  return true;
}

export function isValidPhotoDay(value: unknown): value is PhotoDay {
  if (!isObject(value)) return false;

  return isString(value.date) && isString(value.id) && isArray(value.items);
}

export function isValidManifest(value: unknown): value is Manifest {
  if (!isObject(value)) return false;
  if (!isArray(value.photoDays)) return false;

  if (value.photoDays.length > 0) {
    return isValidPhotoDay(value.photoDays[0]);
  }

  return true;
}

export function isValidMenuManifest(value: unknown): value is MenuManifest {
  return isArray(value);
}

export function isValidCurationManifest(value: unknown): value is CurationManifest {
  if (!isObject(value)) return false;

  return (
    isArray(value.groups) &&
    isObject(value.stats) &&
    isNumber((value.stats as Record<string, unknown>).totalPhotos) &&
    isNumber((value.stats as Record<string, unknown>).totalGroups)
  );
}

export function isValidCache(value: unknown): value is Cache {
  if (!isObject(value)) return false;

  return isNumber(value.version) && isString(value.configHash) && isObject(value.files);
}

export interface ClusteringConstraints {
  disconnects: Array<{ imageId: string; personId: string }>;
  connects: Array<{ imageId: string; personId: string }>;
}

function isValidConstraintEntry(value: unknown): boolean {
  if (!isObject(value)) return false;
  return isString(value.imageId) && isString(value.personId);
}

export function isValidClusteringConstraints(value: unknown): value is ClusteringConstraints {
  if (!isObject(value)) return false;

  const hasDisconnects =
    !value.disconnects ||
    (isArray(value.disconnects) && value.disconnects.every(isValidConstraintEntry));

  const hasConnects =
    !value.connects || (isArray(value.connects) && value.connects.every(isValidConstraintEntry));

  return hasDisconnects && hasConnects;
}

export function isValidImageEntry(value: unknown): value is ImageEntry {
  if (!isObject(value)) return false;

  return (
    isString(value.id) &&
    value.type === "image" &&
    isString(value.src) &&
    isString(value.alt) &&
    isArray(value.sources)
  );
}

export function parseJsonSafe<T>(
  content: string,
  validator: (value: unknown) => value is T,
  defaultValue: T,
): T {
  try {
    const parsed = JSON.parse(content);
    return validator(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function parseJsonOrNull<T>(
  content: string,
  validator: (value: unknown) => value is T,
): T | null {
  try {
    const parsed = JSON.parse(content);
    return validator(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
