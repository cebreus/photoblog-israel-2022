/**
 * Demo/test map data for E2E tests.
 */

import type { MapManifest } from "$shared/types/map";

export const demoMapManifest: MapManifest = {
  meta: {
    version: 1,
    generatedAt: new Date().toISOString(),
    generator: "test-fixture",
  },
  locations: [
    {
      id: "giza",
      lat: 29.9792,
      lng: 31.1342,
      name: "Giza",
      count: 2,
      thumbnail: "https://picsum.photos/seed/giza1/200/200",
      images: [
        {
          id: "demo-giza-1",
          alt: "Giza Pyramid 1",
          detail: "https://picsum.photos/seed/giza1/800/600",
          thumb: "https://picsum.photos/seed/giza1/200/200",
        },
        {
          id: "demo-giza-2",
          alt: "Giza Pyramid 2",
          detail: "https://picsum.photos/seed/giza2/800/600",
          thumb: "https://picsum.photos/seed/giza2/200/200",
        },
      ],
    },
    {
      id: "aswan",
      lat: 23.97,
      lng: 32.88,
      name: "Aswan",
      count: 1,
      thumbnail: "https://picsum.photos/seed/aswan1/200/200",
      images: [
        {
          id: "demo-aswan-1",
          alt: "Aswan Dam",
          detail: "https://picsum.photos/seed/aswan1/800/600",
          thumb: "https://picsum.photos/seed/aswan1/200/200",
        },
      ],
    },
  ],
};
