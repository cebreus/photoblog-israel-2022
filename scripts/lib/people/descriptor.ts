import type { Person } from "../../../src/lib/types/manifest";

export const FACE_DESCRIPTOR_DIMENSION = 128;

export function hasValidFaceDescriptor(person: Person): boolean {
  if (person.clusters && person.clusters.length > 0) return true;
  const descriptor = person.faceDescriptor;
  return Boolean(
    descriptor && Array.isArray(descriptor) && descriptor.length === FACE_DESCRIPTOR_DIMENSION,
  );
}

export function isValidDescriptor(descriptor: number[] | undefined | null): boolean {
  return Boolean(
    descriptor && Array.isArray(descriptor) && descriptor.length === FACE_DESCRIPTOR_DIMENSION,
  );
}

/**
 * Filters people who have valid descriptors AND are actively participating in clustering.
 * People marked as 'junk' are excluded from being matched against new faces.
 */
export function filterPeopleWithValidDescriptors(people: Person[]): Person[] {
  return people.filter(function (p) {
    return !p.junk && hasValidFaceDescriptor(p);
  });
}
