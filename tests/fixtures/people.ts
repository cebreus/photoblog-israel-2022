import type { Person } from "$shared/types/manifest";

export function createMockPerson(overrides: Partial<Person> = {}): Person {
  const id = overrides.id || `person-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name: `Person ${id}`,
    faceDescriptor: Array(128).fill(0),
    clusters: [],
    faceCount: 1,
    thumbnail: `faces/${id}/thumb.jpg`,
    hidden: false,
    junk: false,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}
