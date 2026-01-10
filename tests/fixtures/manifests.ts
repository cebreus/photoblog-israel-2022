import type { ImageEntry, Manifest, PhotoDay } from "$shared/types/manifest";

export function createMockImageEntry(overrides: Partial<ImageEntry> = {}): ImageEntry {
  const id = overrides.id || `img-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    type: "image",
    src: `path/to/${id}.jpg`,
    alt: `Image ${id}`,
    title: `Title ${id}`,
    width: 800,
    height: 600,
    sources: [],
    analysis: {
      sharpness: 10,
      phash: "101010101",
    },
    ...overrides,
  };
}

export function createMockPhotoDay(overrides: Partial<PhotoDay> = {}): PhotoDay {
  return {
    id: "day-1",
    date: "2023-01-01",
    items: [createMockImageEntry()],
    ...overrides,
  };
}

export function createMockManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    photoDays: [createMockPhotoDay()],
    ...overrides,
  };
}
