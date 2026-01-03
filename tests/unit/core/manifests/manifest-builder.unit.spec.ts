/**
 * @fileoverview Manifest Builder Unit Tests
 *
 * @description
 * Tests the creation and assembly of image manifests.
 * Verifies that the internal representation of image data is correctly
 * transformed into the JSON manifest structure used by the frontend.
 *
 * @modules-tested
 * - scripts/lib/manifest-builder.ts
 */

import { describe, expect, it } from "vitest";
import type { Manifest, Separator, StoryDataMap } from "$shared/types/manifest";
import type { ProcessedImageResult } from "../../../../scripts/lib/image/processor";
import { updateManifest } from "../../../../scripts/lib/manifests/builder";

describe("manifest-builder: updateManifest", () => {
  it("aggregates cities and locations into PhotoDay and populates stories", () => {
    // 1. Mock Data
    const mockImage1: ProcessedImageResult = {
      key: "egypt-2025/IMG_1.jpeg",
      hash: "abc",
      mtimeMs: 123,
      bytes: 1000,
      outputs: [],
      image: {
        id: "1",
        type: "image",
        src: "IMG_1.jpeg",
        alt: "",
        title: "",
        sources: [],
        exif: {
          date: "2022-10-20T10:00:00.000Z",
          city: "Haifa",
          location: "Baha’istické zahrady",
        },
      },
    };

    const mockImage2: ProcessedImageResult = {
      key: "egypt-2025/IMG_2.jpeg",
      hash: "def",
      mtimeMs: 124,
      bytes: 1000,
      outputs: [],
      image: {
        id: "2",
        type: "image",
        src: "IMG_2.jpeg",
        alt: "",
        title: "",
        sources: [],
        exif: {
          date: "2022-10-20T12:00:00.000Z", // Same day
          city: "Akko",
          location: "Citadela",
        },
      },
    };

    // New Day
    const mockImage3: ProcessedImageResult = {
      key: "egypt-2025/IMG_3.jpeg",
      hash: "ghi",
      mtimeMs: 125,
      bytes: 1000,
      outputs: [],
      image: {
        id: "3",
        type: "image",
        src: "IMG_3.jpeg",
        alt: "",
        title: "",
        sources: [],
        exif: {
          date: "2022-10-21T10:00:00.000Z",
          city: "Nazareth",
          location: "Bazilika Zvěstování",
        },
      },
    };

    // Add more images to trigger separator (>2 images required)
    const mockImage1b: ProcessedImageResult = {
      key: "egypt-2025/IMG_1b.jpeg",
      hash: "abc2",
      mtimeMs: 123,
      bytes: 1000,
      outputs: [],
      image: {
        id: "1b",
        type: "image",
        src: "IMG_1b.jpeg",
        alt: "",
        title: "",
        sources: [],
        exif: {
          date: "2022-10-20T10:05:00.000Z",
          city: "Haifa",
          location: "Baha’istické zahrady",
        },
      },
    };

    const mockImage1c: ProcessedImageResult = {
      key: "egypt-2025/IMG_1c.jpeg",
      hash: "abc3",
      mtimeMs: 123,
      bytes: 1000,
      outputs: [],
      image: {
        id: "1c",
        type: "image",
        src: "IMG_1c.jpeg",
        alt: "",
        title: "",
        sources: [],
        exif: {
          date: "2022-10-20T10:10:00.000Z",
          city: "Haifa",
          location: "Baha’istické zahrady",
        },
      },
    };

    const results = [mockImage1, mockImage1b, mockImage1c, mockImage2, mockImage3];

    const storyData: StoryDataMap = {
      // Story for a location
      "Baha’istické zahrady": {
        title: "Gardens Title",
        content: "Gardens Content",
        location: "Baha’istické zahrady",
        startDate: "2022-10-20T10:00:00",
      },
      // Story for a day
      "2022-10-20": {
        title: "Day 1 Title",
        content: "Day 1 Content",
        date: "2022-10-20",
      },
    };

    const existingManifest: Manifest = { photoDays: [] };

    // 2. Execution
    const manifest = updateManifest(
      results,
      [], // deletedKeys
      storyData,
      existingManifest,
    );

    // 3. Assertions

    // Check Day 1 (2022-10-20)
    const day1 = manifest.photoDays.find((d) => d.date === "2022-10-20");
    expect(day1).toBeDefined();
    if (!day1) return;

    // Cities and Locations aggregation
    expect(day1.cities).toEqual(["Haifa", "Akko"]);
    expect(day1.locations).toEqual(["Baha’istické zahrady", "Citadela"]);

    // Day Story
    expect(day1.story).toBe("Day 1 Content");

    // JSON Field Order (Check keys of the object)
    const dayKeys = Object.keys(day1);
    const expectedOrder = ["date", "cities", "locations", "story", "items", "id"];
    // We filter keys to only check the ones we care about ordering for, or exact match if possible
    // Note: 'items' and 'id' position matters.
    expect(dayKeys).toEqual(expectedOrder);

    // Check Separator Story in items
    // First item should be separator for Baha’istické zahrady (aggregated logic creates separators)
    const separator = day1.items.find(
      (i) => i.type === "separator" && i.location === "Baha’istické zahrady",
    );
    expect(separator).toBeDefined();
    if (separator?.type === "separator") {
      // marked.parse wraps simple text in <p> tag by default and adds newline
      expect(separator.story?.trim()).toBe("<p>Gardens Content</p>");
      expect(separator).not.toHaveProperty("storyContent");
      expect(separator).not.toHaveProperty("storyHtml");
    }

    // Check Day 2 (2022-10-21)
    const day2 = manifest.photoDays.find((d) => d.date === "2022-10-21");
    expect(day2).toBeDefined();
    expect(day2?.cities).toEqual(["Nazareth"]);
    expect(day2?.story).toBeUndefined(); // No story for this day
  });

  it("creates multiple separators for a location with multiple visits", () => {
    const storyData: StoryDataMap = {
      Hotel: {
        title: "The Hotel",
        content: "Our base",
        location: "Hotel",
        visits: [
          { startDate: "2025-11-25T08:00:00", endDate: "2025-11-25T09:00:00" },
          { startDate: "2025-11-25T18:00:00", endDate: "2025-11-25T20:00:00" },
        ],
      },
    };

    const existingManifest: Manifest = { photoDays: [] };
    const manifest = updateManifest([], [], storyData, existingManifest);

    const day = manifest.photoDays.find((d) => d.date === "2025-11-25");
    expect(day).toBeDefined();
    if (!day) return;

    const separators = day.items.filter(
      (item) => item.type === "separator" && item.location === "Hotel",
    ) as Separator[];

    expect(separators.length).toBe(2);
    expect(separators[0].id).toBe("loc-hotel-0800");
    expect(separators[1].id).toBe("loc-hotel-1800");
  });

  it("handles markdown dates correctly during sorting", () => {
    // loadStoryData normalizes all dates to strings, so Date objects
    // should never reach the builder. This test verifies the string path works.
    const storyData: StoryDataMap = {
      "Old Tomb": {
        title: "Old Tomb",
        content: "Historic site",
        location: "Old Tomb",
        startDate: "2025-11-25T10:00:00",
      },
    };

    const existingManifest: Manifest = { photoDays: [] };
    // updateManifest calls organizeDayItems -> allItems.sort(compareItemsByTimestamp)
    const manifest = updateManifest([], [], storyData, existingManifest);

    const day = manifest.photoDays.find((d) => d.date === "2025-11-25");
    expect(day).toBeDefined();
    expect(day?.items.length).toBe(1);
    expect(day?.items[0].type).toBe("separator");
  });
});
