import type { Person } from "../../src/lib/types/manifest";

export const FACE_DESCRIPTOR_DIMENSION = 128;

export function hasValidFaceDescriptor(person: Person): boolean {
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

export function filterPeopleWithValidDescriptors(people: Person[]): Person[] {
  return people.filter(hasValidFaceDescriptor);
}
