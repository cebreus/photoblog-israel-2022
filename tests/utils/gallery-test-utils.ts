/**
 * @fileoverview Gallery Test Utilities
 *
 * @description
 * Reusable test data factories for photoblog tests.
 * Provides consistent mock data for manifests, photos, and people.
 */

import type {
  ImageEntry,
  Person,
  PhotoDay,
  QualityBucket,
  SequenceInfo,
  SequenceType,
} from "../../shared/types/manifest";

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

/**
 * Creates a mock CollageRequest for testing.
 */
export function createMockCollageRequest(
  overrides: Partial<import("../../src/lib/types/collage").CollageRequest> = {},
): import("../../src/lib/types/collage").CollageRequest {
  return {
    items: overrides.items || [
      {
        imageId: "test1.jpg",
        crop: { x: 50, y: 50, scale: 1 },
      },
      {
        imageId: "test2.jpg",
        crop: { x: 50, y: 50, scale: 1 },
      },
    ],
    template: overrides.template || "row",
    aspectRatio: overrides.aspectRatio || "auto",
    border: overrides.border || { width: 10 },
    ...overrides,
  };
}
/**
 * Creates a mock SequenceInfo object.
 */
export function createMockSequenceInfo(
  type: SequenceType = "zoom",
  total: number = 3,
  index?: number,
): SequenceInfo {
  return {
    type,
    total,
    index: index ?? total,
    baseId: `test-${type}-base`,
  };
}

/**
 * Creates a mock sequence member image.
 * Used for testing sequence detection and playback.
 */
export function createMockSequenceImage(
  baseId: string,
  type: SequenceType,
  index: number,
  total: number,
  overrides: Partial<ImageEntry> = {},
): ImageEntry {
  const suffix = type === "pano" ? "pano" : `${type}${index}from${total}`;
  const id = `${baseId}--${suffix}`;

  return createMockImage({
    id,
    type: index === total ? "sequence" : "sequence-member",
    sequenceInfo: {
      type,
      index,
      total,
      baseId,
    },
    sources: [
      {
        variant: "detail",
        type: "image/jpeg",
        path: `/gallery/images/detail/${id}.jpg`,
        width: 1280,
        height: 720,
      },
      {
        variant: "default",
        type: "image/jpeg",
        path: `/gallery/images/default/${id}.jpg`,
        width: 370,
        height: 208,
      },
    ],
    ...overrides,
  });
}

/**
 * Creates a complete sequence (all members) for testing.
 */
export function createMockSequence(
  baseId: string,
  type: SequenceType,
  total: number,
  overrides: Partial<ImageEntry> = {},
): ImageEntry[] {
  return Array.from({ length: total }, (_, i) =>
    createMockSequenceImage(baseId, type, i + 1, total, overrides),
  );
}

/**
 * Creates a mock panorama image.
 */
export function createMockPanorama(
  baseId: string,
  overrides: Partial<ImageEntry> = {},
): ImageEntry {
  const id = `${baseId}--pano`;

  return createMockImage({
    id,
    type: "panorama",
    width: 6000,
    height: 1280,
    sequenceInfo: {
      type: "pano",
      index: 1,
      total: 1,
      baseId,
    },
    sources: [
      {
        variant: "pano_detail",
        type: "image/jpeg",
        path: `/gallery/images/pano_detail/${id}.jpg`,
        width: 6000,
        height: 1280,
      },
      {
        variant: "default",
        type: "image/jpeg",
        path: `/gallery/images/default/${id}.jpg`,
        width: 370,
        height: 208,
      },
    ],
    ...overrides,
  });
}
