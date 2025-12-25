/**
 * @fileoverview Gallery Test Utilities
 *
 * @description
 * Reusable test data factories for photoblog tests.
 * Provides consistent mock data for manifests, photos, and people.
 */

import type { ImageEntry, Person, PhotoDay, QualityBucket } from "../../shared/types/manifest";

/**
 * Creates a mock ImageEntry with sensible defaults.
 */
export function createMockImage(overrides: Partial<ImageEntry> = {}): ImageEntry {
  const id = overrides.id || `img-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    type: "image",
    src: `pics/${id}.jpg`,
    alt: `Image ${id}`,
    title: overrides.title || `Title ${id}`,
    width: overrides.width || 800,
    height: overrides.height || 600,
    sources: overrides.sources || [],
    people: overrides.people || [],
    analysis: overrides.analysis || {
      sharpness: 10,
      phash: "101010101",
      qualityBucket: "good" as QualityBucket,
    },
    exif: overrides.exif || {
      date: "2025-01-01T12:00:00",
    },
    ...overrides,
  };
}

/**
 * Creates a mock Person with sensible defaults.
 */
export function createMockPerson(overrides: Partial<Person> = {}): Person {
  const id = overrides.id || `person-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name: overrides.name || `Person ${id.slice(0, 8)}`,
    faceDescriptor: overrides.faceDescriptor || Array(128).fill(0),
    clusters: overrides.clusters || [],
    faceCount: overrides.faceCount ?? 1,
    thumbnail: overrides.thumbnail || `faces/${id}/thumb.jpg`,
    hidden: overrides.hidden ?? false,
    junk: overrides.junk ?? false,
    createdAt: overrides.createdAt || new Date().toISOString(),
    lastSeenAt: overrides.lastSeenAt || new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock PhotoDay with specified number of images.
 */
export function createMockPhotoDay(
  date: string,
  imageCount: number,
  options: {
    withPeople?: boolean;
    peopleIds?: string[];
    location?: string;
  } = {},
): PhotoDay {
  const images = Array.from({ length: imageCount }, (_, i) =>
    createMockImage({
      id: `${date}-img-${i}`,
      people: options.withPeople ? options.peopleIds || [`person-${i % 3}`] : [],
    }),
  );

  return {
    id: `day-${date}`,
    date,
    items: images,
  };
}

/**
 * Creates a complete gallery manifest with specified days and images.
 */
export function createMockGalleryManifest(
  days: number,
  imagesPerDay: number,
  options: { withPeople?: boolean } = {},
) {
  const startDate = new Date("2025-01-01");

  const photoDays = Array.from({ length: days }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    return createMockPhotoDay(dateStr, imagesPerDay, options);
  });

  return { photoDays };
}

/**
 * Creates a set of mock people for testing.
 */
export function createMockPeopleSet(count: number): Person[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPerson({
      id: `person-${i + 1}`,
      name: `Person ${i + 1}`,
      faceCount: (count - i) * 5, // Descending face counts
    }),
  );
}

/**
 * Creates mock people with specific categories for testing filters.
 */
export function createCategorizedPeople(): Person[] {
  return [
    createMockPerson({ id: "alice--named", name: "Alice", faceCount: 10, category: "person" }),
    createMockPerson({ id: "bob--named", name: "Bob", faceCount: 5, category: "person" }),
    createMockPerson({ id: "person-1", name: "Person 1", faceCount: 8 }), // Generic
    createMockPerson({ id: "statue-1", name: "Sphinx", faceCount: 3, category: "statue" }),
    createMockPerson({ id: "painting-1", name: "Mona Lisa", faceCount: 2, category: "painting" }),
    createMockPerson({ id: "hidden-1", name: "Hidden Person", faceCount: 4, hidden: true }),
    createMockPerson({ id: "junk-1", name: "Junk Face", faceCount: 1, junk: true }),
  ];
}
